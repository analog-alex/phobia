"""Rig and animate an infected-variant model in Blender, replacing the
manual segment-distance skinning in rig-zombie.mjs with a real armature,
envelope weighting, and keyframed idle/walk/run/attack/death cycles.

Usage:
  blender --background --python scripts/rig-zombie-blender.py -- <input.glb> <output.glb> <character>

<character> selects a bone-position table from CHARACTERS below (currently
"zombie" or "acid") -- rest-pose geometry differs per source mesh, so each
character needs its own measured bone_head/bone_tail. Everything else
(armature topology, weighting, animation tracks) is shared.

Run against assests/Meshy_AI__0626205329_texture.glb (character "zombie") or
assests/Meshy_AI_Neon_Plague_Chemist_0626210338_texture.glb (character
"acid"), then feed the output through `bun run assets:optimize` (the
"animated infected" / "animated acid infected" entries) to produce the
runtime-sized *_balanced.glb consumed by src/core/Game.ts.
"""

import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) != 3:
    raise SystemExit(
        "Usage: blender --background --python rig-zombie-blender.py -- "
        "<input.glb> <output.glb> <character: zombie|acid>"
    )
SRC, OUT, CHARACTER = argv

FPS = 24

# Bone positions measured directly from each mesh's own rest pose (already a
# hunched stance, not a T-pose) in Blender space. Verified empirically
# against this glTF/importer combo: blender(x, y, z) = gltf(x, z, y) -- a
# plain axis permutation with no sign flips (confirmed via bbox + vertex
# probes, not the textbook glTF Y-up-to-Blender-Z-up formula). Re-verify
# before trusting this mapping for a source exported by a different pipeline.
#
# "acid" reuses the "zombie" skeleton unscaled: gltf-transform inspect shows
# near-identical overall bbox/proportions between the two source meshes
# (height -0.95..0.95 on both; only z-depth differs, 0.307 vs 0.405), and
# the acid mesh's pose is asymmetric enough (equipment/apparatus skewing
# simple per-band vertex probes) that a fresh landmark-probe pass wasn't
# reliable -- reusing the proven skeleton and validating the result via the
# envelope fallback-coverage count and a render sanity check was the more
# trustworthy path. Revisit with per-mesh measurements if that check ever
# shows visible mismatch.
CHARACTERS = {
    "zombie": {
        "mesh_name": "ZombieMesh",
        "bone_head": {
            "hips": (0, 0, -0.34),
            "spine": (0, 0, 0.02),
            "chest": (0, 0, 0.42),
            "head": (0, -0.02, 0.73),
            "leftUpperArm": (-0.28, 0, 0.48),
            "leftForearm": (-0.39, -0.04, 0.12),
            "rightUpperArm": (0.28, 0, 0.48),
            "rightForearm": (0.39, -0.04, 0.12),
            "leftUpperLeg": (-0.16, 0, -0.34),
            "leftLowerLeg": (-0.18, 0, -0.64),
            "rightUpperLeg": (0.16, 0, -0.34),
            "rightLowerLeg": (0.18, 0, -0.64),
        },
        "bone_tail_extra": {
            "head": (0, -0.02, 0.96),
            "leftForearm": (-0.42, -0.1, -0.25),
            "rightForearm": (0.42, -0.1, -0.25),
            "leftLowerLeg": (-0.18, 0.03, -0.96),
            "rightLowerLeg": (0.18, 0.03, -0.96),
        },
    },
    "acid": {
        "mesh_name": "AcidZombieMesh",
        "bone_head": {
            "hips": (0, 0, -0.34),
            "spine": (0, 0, 0.02),
            "chest": (0, 0, 0.42),
            "head": (0, -0.02, 0.73),
            "leftUpperArm": (-0.28, 0, 0.48),
            "leftForearm": (-0.39, -0.04, 0.12),
            "rightUpperArm": (0.28, 0, 0.48),
            "rightForearm": (0.39, -0.04, 0.12),
            "leftUpperLeg": (-0.16, 0, -0.34),
            "leftLowerLeg": (-0.18, 0, -0.64),
            "rightUpperLeg": (0.16, 0, -0.34),
            "rightLowerLeg": (0.18, 0, -0.64),
        },
        "bone_tail_extra": {
            "head": (0, -0.02, 0.96),
            "leftForearm": (-0.42, -0.1, -0.25),
            "rightForearm": (0.42, -0.1, -0.25),
            "leftLowerLeg": (-0.18, 0.03, -0.96),
            "rightLowerLeg": (0.18, 0.03, -0.96),
        },
    },
}

if CHARACTER not in CHARACTERS:
    raise SystemExit(f"Unknown character {CHARACTER!r}; choose one of {list(CHARACTERS)}")

# Bone hierarchy/topology is the same for every character -- only the head
# positions above (and the tail overrides for leaf bones) vary per mesh.
BONE_PARENT = {
    "spine": "hips",
    "chest": "spine",
    "head": "chest",
    "leftUpperArm": "chest",
    "leftForearm": "leftUpperArm",
    "rightUpperArm": "chest",
    "rightForearm": "rightUpperArm",
    "leftUpperLeg": "hips",
    "leftLowerLeg": "leftUpperLeg",
    "rightUpperLeg": "hips",
    "rightLowerLeg": "rightUpperLeg",
}
BONE_CONNECT = {
    "spine": True,
    "chest": True,
    "head": True,
    "leftUpperArm": False,
    "leftForearm": True,
    "rightUpperArm": False,
    "rightForearm": True,
    "leftUpperLeg": False,
    "leftLowerLeg": True,
    "rightUpperLeg": False,
    "rightLowerLeg": True,
}
TORSO_BONES = {"hips", "spine", "chest", "head"}


def closest_point_on_segment(p, a, b):
    ab = [b[i] - a[i] for i in range(3)]
    ap = [p[i] - a[i] for i in range(3)]
    len_sq = sum(c * c for c in ab)
    t = 0.0 if len_sq == 0 else max(0.0, min(1.0, sum(ap[i] * ab[i] for i in range(3)) / len_sq))
    return sum((p[i] - (a[i] + ab[i] * t)) ** 2 for i in range(3))


def cycle(positive, negative=None):
    """5-sample back-and-forth oscillation that loops seamlessly
    (first == last)."""
    if negative is None:
        negative = -positive
    return [positive, 0.0, negative, 0.0, positive]


def beat(*values):
    """Explicit one-shot keyframe sequence -- no loop-closure requirement.
    e.g. beat(0, -0.15, -0.55, -0.1) = windup -> full extension -> settle."""
    return list(values)


def build_armature(config, mesh_obj):
    bone_head = config["bone_head"]
    # Chain bones point at their child's head; leaf bones use the explicit
    # tail override (hand/foot/head-top endpoints beyond the last joint).
    bone_tail = {}
    children_of = {}
    for name, parent in BONE_PARENT.items():
        children_of.setdefault(parent, []).append(name)
    for name in bone_head:
        if name in config["bone_tail_extra"]:
            bone_tail[name] = config["bone_tail_extra"][name]
        else:
            child = children_of[name][0]
            bone_tail[name] = bone_head[child]

    armature_data = bpy.data.armatures.new(f"{config['mesh_name']}ArmatureData")
    armature_obj = bpy.data.objects.new(f"{config['mesh_name']}Armature", armature_data)
    bpy.context.collection.objects.link(armature_obj)
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode="EDIT")

    bone_radius = {name: (0.20 if name in TORSO_BONES else 0.11) for name in bone_head}
    edit_bones = armature_data.edit_bones
    for name in bone_head:
        b = edit_bones.new(name)
        b.head = bone_head[name]
        b.tail = bone_tail[name]
        b.head_radius = bone_radius[name]
        b.tail_radius = bone_radius[name]
        b.envelope_distance = 0.16

    for name, parent_name in BONE_PARENT.items():
        edit_bones[name].parent = edit_bones[parent_name]
        edit_bones[name].use_connect = BONE_CONNECT[name]

    bpy.ops.object.mode_set(mode="OBJECT")
    print("armature bones:", len(armature_data.bones))

    # Heat-map ("ARMATURE_AUTO") weighting fails outright on these meshes
    # (all-zero weights) -- likely disconnected shells typical of
    # AI-generated single-mesh characters (teeth/eyes/etc as separate
    # islands break the surface heat solve). Envelope weighting is
    # distance-based and doesn't depend on mesh connectivity, so it degrades
    # gracefully instead of failing outright.
    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj
    with bpy.context.temp_override(
        active_object=armature_obj,
        selected_editable_objects=[mesh_obj, armature_obj],
        selected_objects=[mesh_obj, armature_obj],
        object=armature_obj,
    ):
        bpy.ops.object.parent_set(type="ARMATURE_ENVELOPE")

    print(
        "mesh parent:", mesh_obj.parent,
        "modifiers:", [m.type for m in mesh_obj.modifiers],
    )

    # Envelope falloff doesn't always reach thin extremities (fingertips,
    # ears, nose). Any vertex the envelope pass missed gets pinned to its
    # nearest bone segment so nothing is left undeformed (which would
    # tear/stretch when the rest of the body animates).
    bone_names = list(bone_head.keys())
    group_index = {g.name: g.index for g in mesh_obj.vertex_groups}
    weighted_group_ids = set(group_index.values())
    fixed = 0
    for v in mesh_obj.data.vertices:
        total = sum(g.weight for g in v.groups if g.group in weighted_group_ids)
        if total > 1e-6:
            continue
        p = (v.co.x, v.co.y, v.co.z)
        best_name = min(
            bone_names,
            key=lambda n: closest_point_on_segment(p, bone_head[n], bone_tail[n]),
        )
        mesh_obj.vertex_groups[best_name].add([v.index], 1.0, "REPLACE")
        fixed += 1
    total_verts = len(mesh_obj.data.vertices)
    print(
        f"fallback-weighted verts: {fixed} / {total_verts}"
        f" ({100 * fixed / total_verts:.1f}%)"
    )

    return armature_obj


def bake_action(armature_obj, name, duration_seconds, tracks):
    """tracks: dict bone_name -> {'x': [N vals], 'z': [N vals] (optional)}.
    Sample count is taken from the track data, so both the seamless-loop
    cycle() shape and one-shot beat() sequences of any length work."""
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature_obj.animation_data_create()
    armature_obj.animation_data.action = action
    sample_count = max(
        len(axes.get("x", axes.get("z", []))) for axes in tracks.values()
    )
    frames = [
        round(duration_seconds * FPS * f / (sample_count - 1))
        for f in range(sample_count)
    ]
    for bone_name, axes in tracks.items():
        pb = armature_obj.pose.bones[bone_name]
        for i, frame in enumerate(frames):
            bpy.context.scene.frame_set(frame)
            rot = [0.0, 0.0, 0.0]
            if "x" in axes:
                rot[0] = axes["x"][i]
            if "z" in axes:
                rot[2] = axes["z"][i]
            pb.rotation_euler = rot
            pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    return action


def bake_all_animations(armature_obj):
    # Bones point head-to-tail along local +Y, so rotating local X swings a
    # limb forward/back in the sagittal plane -- every track below only
    # touches X (swing) and, for a little secondary motion on the torso, Z
    # (twist). Shared across every character: only bone names matter here.
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode="POSE")
    for pb in armature_obj.pose.bones:
        pb.rotation_mode = "XYZ"

    idle_tracks = {
        "spine": {"x": cycle(0.03), "z": cycle(0.02)},
        "chest": {"z": cycle(0.025), "x": cycle(-0.015)},
        "head": {"x": cycle(0.02)},
    }
    bake_action(armature_obj, "ZombieIdle", 2.0, idle_tracks)

    walk_tracks = {
        "spine": {"x": cycle(0.05), "z": cycle(0.03)},
        "chest": {"x": cycle(-0.02)},
        "leftUpperArm": {"x": cycle(-0.35, 0.28)},
        "leftForearm": {"x": cycle(-0.22, 0.15)},
        "rightUpperArm": {"x": cycle(0.35, -0.28)},
        "rightForearm": {"x": cycle(0.22, -0.15)},
        "leftUpperLeg": {"x": cycle(0.45, -0.4)},
        "leftLowerLeg": {"x": cycle(0.35, -0.1)},
        "rightUpperLeg": {"x": cycle(-0.45, 0.4)},
        "rightLowerLeg": {"x": cycle(-0.35, 0.1)},
    }
    bake_action(armature_obj, "ZombieWalk", 1.0, walk_tracks)

    run_tracks = {
        "hips": {"x": cycle(0.08, -0.03)},
        "spine": {"x": cycle(0.08), "z": cycle(0.05)},
        "chest": {"x": cycle(-0.04)},
        "leftUpperArm": {"x": cycle(-0.52, 0.42)},
        "leftForearm": {"x": cycle(-0.34, 0.24)},
        "rightUpperArm": {"x": cycle(0.52, -0.42)},
        "rightForearm": {"x": cycle(0.34, -0.24)},
        "leftUpperLeg": {"x": cycle(0.68, -0.6)},
        "leftLowerLeg": {"x": cycle(0.55, -0.2)},
        "rightUpperLeg": {"x": cycle(-0.68, 0.6)},
        "rightLowerLeg": {"x": cycle(-0.55, 0.2)},
    }
    bake_action(armature_obj, "ZombieRun", 0.65, run_tracks)

    # One-shot lunge: torso drives forward, both arms swing in as a claw
    # strike, weight shifts onto the front leg. Does not loop -- Enemy.ts
    # plays it once.
    attack_tracks = {
        "spine": {"x": beat(0.03, 0.15, 0.32, 0.08)},
        "chest": {
            "x": beat(-0.02, -0.15, 0.38, 0.0),
            "z": beat(0.02, 0.05, -0.08, 0.02),
        },
        "head": {"x": beat(0.02, 0.05, 0.22, 0.03)},
        "rightUpperArm": {"x": beat(0.1, -0.55, -0.95, 0.1)},
        "rightForearm": {"x": beat(0.1, -0.35, -0.65, 0.1)},
        "leftUpperArm": {"x": beat(-0.1, -0.4, -0.75, -0.1)},
        "leftForearm": {"x": beat(-0.1, -0.25, -0.55, -0.1)},
        "rightUpperLeg": {"x": beat(0.0, 0.1, 0.28, 0.05)},
    }
    bake_action(armature_obj, "ZombieAttack", 0.5, attack_tracks)

    # One-shot collapse: knees buckle, spine folds forward, arms go slack.
    # Ends on a collapsed pose (does not return to idle). The existing
    # procedural root tip-over in Enemy.ts handles the "falls to floor"
    # motion; this is the limb "go limp" motion layered under it on the
    # armature.
    death_tracks = {
        "spine": {"x": beat(0.03, 0.4, 0.75, 0.9)},
        "chest": {"x": beat(-0.02, 0.15, 0.5, 0.7)},
        "head": {"x": beat(0.02, 0.3, 0.55, 0.65)},
        "leftUpperArm": {"x": beat(-0.1, -0.3, -0.6, -0.75)},
        "rightUpperArm": {"x": beat(0.1, -0.2, -0.55, -0.7)},
        "leftUpperLeg": {"x": beat(0.0, 0.35, 0.6, 0.7)},
        "rightUpperLeg": {"x": beat(0.0, 0.3, 0.55, 0.65)},
        "leftLowerLeg": {"x": beat(0.0, 0.4, 0.7, 0.85)},
        "rightLowerLeg": {"x": beat(0.0, 0.35, 0.65, 0.8)},
    }
    bake_action(armature_obj, "ZombieDeath", 0.9, death_tracks)

    bpy.context.scene.frame_set(0)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("actions:", [a.name for a in bpy.data.actions])


config = CHARACTERS[CHARACTER]

bpy.context.scene.render.fps = FPS
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

mesh_obj = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
mesh_obj.name = config["mesh_name"]

armature_obj = build_armature(config, mesh_obj)
bake_all_animations(armature_obj)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_animation_mode="ACTIONS",
    export_apply=False,
    use_selection=False,
)
print("WROTE", OUT)
