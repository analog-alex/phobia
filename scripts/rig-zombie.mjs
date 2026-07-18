import {
  Accessor,
  AnimationChannel,
  AnimationSampler,
  NodeIO,
} from "@gltf-transform/core";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: bun scripts/rig-zombie.mjs <input.glb> <output.glb>");
}

const io = new NodeIO();
const document = await io.read(inputPath);
const root = document.getRoot();
const buffer = root.listBuffers()[0] ?? document.createBuffer("zombie rig");

const bones = [
  { name: "hips", position: [0, -0.34, 0], parent: -1 },
  { name: "spine", position: [0, 0.02, 0], parent: 0 },
  { name: "chest", position: [0, 0.42, 0], parent: 1 },
  { name: "head", position: [0, 0.73, -0.02], parent: 2 },
  { name: "leftUpperArm", position: [-0.28, 0.48, 0], parent: 2 },
  { name: "leftForearm", position: [-0.39, 0.12, -0.04], parent: 4 },
  { name: "rightUpperArm", position: [0.28, 0.48, 0], parent: 2 },
  { name: "rightForearm", position: [0.39, 0.12, -0.04], parent: 6 },
  { name: "leftUpperLeg", position: [-0.16, -0.34, 0], parent: 0 },
  { name: "leftLowerLeg", position: [-0.18, -0.64, 0], parent: 8 },
  { name: "rightUpperLeg", position: [0.16, -0.34, 0], parent: 0 },
  { name: "rightLowerLeg", position: [0.18, -0.64, 0], parent: 10 },
];

const boneNodes = bones.map((bone) =>
  document
    .createNode(bone.name)
    .setTranslation(
      bone.parent < 0
        ? bone.position
        : bone.position.map(
            (value, axis) => value - bones[bone.parent].position[axis]
          )
    )
);
boneNodes.forEach((node, index) => {
  const parent = bones[index].parent;
  if (parent >= 0) boneNodes[parent].addChild(node);
});
root.listScenes()[0].addChild(boneNodes[0]);

const inverseBindMatrices = new Float32Array(bones.length * 16);
bones.forEach((bone, index) => {
  const offset = index * 16;
  inverseBindMatrices[offset] = 1;
  inverseBindMatrices[offset + 5] = 1;
  inverseBindMatrices[offset + 10] = 1;
  inverseBindMatrices[offset + 15] = 1;
  inverseBindMatrices[offset + 12] = -bone.position[0];
  inverseBindMatrices[offset + 13] = -bone.position[1];
  inverseBindMatrices[offset + 14] = -bone.position[2];
});
const ibmAccessor = document
  .createAccessor("zombie inverse bind matrices")
  .setType(Accessor.Type.MAT4)
  .setArray(inverseBindMatrices)
  .setBuffer(buffer);
const skin = document
  .createSkin("zombie humanoid rig")
  .setSkeleton(boneNodes[0])
  .setInverseBindMatrices(ibmAccessor);
boneNodes.forEach((node) => {
  skin.addJoint(node);
});
root.listNodes().forEach((node) => {
  if (node.getMesh()) node.setSkin(skin);
});

const distanceToSegmentSquared = (point, start, end) => {
  const ab = end.map((value, axis) => value - start[axis]);
  const ap = point.map((value, axis) => value - start[axis]);
  const lengthSquared = ab.reduce((sum, value) => sum + value * value, 0);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ap.reduce((sum, value, axis) => sum + value * ab[axis], 0) / lengthSquared
    )
  );
  return point.reduce((sum, value, axis) => {
    const distance = value - (start[axis] + ab[axis] * projection);
    return sum + distance * distance;
  }, 0);
};

const segments = [
  [bones[0].position, bones[1].position],
  [bones[1].position, bones[2].position],
  [bones[2].position, bones[3].position],
  [bones[3].position, [0, 0.96, -0.02]],
  [bones[4].position, bones[5].position],
  [bones[5].position, [-0.42, -0.25, -0.1]],
  [bones[6].position, bones[7].position],
  [bones[7].position, [0.42, -0.25, -0.1]],
  [bones[8].position, bones[9].position],
  [bones[9].position, [-0.18, -0.96, 0.03]],
  [bones[10].position, bones[11].position],
  [bones[11].position, [0.18, -0.96, 0.03]],
];

const candidatesFor = ([x, y]) => {
  if (y > 0.66) return [3, 2];
  if (y < -0.27) return x < 0 ? [8, 9, 0] : [10, 11, 0];
  if (Math.abs(x) > 0.25) return x < 0 ? [4, 5, 2, 1] : [6, 7, 2, 1];
  return y > 0.34 ? [2, 3, 1] : [1, 0, 2];
};

const point = [0, 0, 0];
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute("POSITION");
    if (!positions) continue;
    const joints = new Uint16Array(positions.getCount() * 4);
    const weights = new Float32Array(positions.getCount() * 4);
    for (let vertex = 0; vertex < positions.getCount(); vertex += 1) {
      positions.getElement(vertex, point);
      const influences = candidatesFor(point)
        .map((boneIndex) => ({
          boneIndex,
          weight:
            1 /
            Math.max(
              0.0004,
              distanceToSegmentSquared(
                point,
                segments[boneIndex][0],
                segments[boneIndex][1]
              )
            ),
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4);
      const total = influences.reduce(
        (sum, influence) => sum + influence.weight,
        0
      );
      influences.forEach((influence, slot) => {
        joints[vertex * 4 + slot] = influence.boneIndex;
        weights[vertex * 4 + slot] = influence.weight / total;
      });
    }
    primitive.setAttribute(
      "JOINTS_0",
      document
        .createAccessor("zombie joints")
        .setType(Accessor.Type.VEC4)
        .setArray(joints)
        .setBuffer(buffer)
    );
    primitive.setAttribute(
      "WEIGHTS_0",
      document
        .createAccessor("zombie weights")
        .setType(Accessor.Type.VEC4)
        .setArray(weights)
        .setBuffer(buffer)
    );
  }
}

const quaternionFromEuler = (x = 0, y = 0, z = 0) => {
  const sx = Math.sin(x / 2);
  const cx = Math.cos(x / 2);
  const sy = Math.sin(y / 2);
  const cy = Math.cos(y / 2);
  const sz = Math.sin(z / 2);
  const cz = Math.cos(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
};

const addAnimation = (name, times, tracks) => {
  const animation = document.createAnimation(name);
  const input = document
    .createAccessor(`${name} times`)
    .setType(Accessor.Type.SCALAR)
    .setArray(new Float32Array(times))
    .setBuffer(buffer);
  for (const [boneIndex, rotations] of tracks) {
    const output = document
      .createAccessor(`${name} ${bones[boneIndex].name}`)
      .setType(Accessor.Type.VEC4)
      .setArray(
        new Float32Array(
          rotations.flatMap((rotation) => quaternionFromEuler(...rotation))
        )
      )
      .setBuffer(buffer);
    const sampler = document
      .createAnimationSampler()
      .setInterpolation(AnimationSampler.Interpolation.LINEAR)
      .setInput(input)
      .setOutput(output);
    const channel = document
      .createAnimationChannel()
      .setTargetNode(boneNodes[boneIndex])
      .setTargetPath(AnimationChannel.TargetPath.ROTATION)
      .setSampler(sampler);
    animation.addSampler(sampler).addChannel(channel);
  }
};

const cycle = (positive, negative = -positive) => [
  [positive, 0, 0],
  [0, 0, 0],
  [negative, 0, 0],
  [0, 0, 0],
  [positive, 0, 0],
];
const locomotionTimes = [0, 0.25, 0.5, 0.75, 1];
addAnimation(
  "ZombieIdle",
  [0, 0.5, 1, 1.5, 2],
  [
    [
      1,
      [
        [-0.03, 0, -0.025],
        [-0.01, 0.025, 0],
        [-0.035, 0, 0.025],
        [-0.01, -0.025, 0],
        [-0.03, 0, -0.025],
      ],
    ],
    [
      2,
      [
        [0, 0, 0.02],
        [0.025, 0, 0],
        [0, 0, -0.02],
        [-0.015, 0, 0],
        [0, 0, 0.02],
      ],
    ],
    [
      3,
      [
        [0.02, -0.04, 0],
        [0, 0.03, 0.02],
        [-0.025, 0.04, 0],
        [0, -0.03, -0.015],
        [0.02, -0.04, 0],
      ],
    ],
  ]
);
addAnimation("ZombieWalk", locomotionTimes, [
  [
    1,
    [
      [-0.04, 0, -0.04],
      [-0.02, 0, 0],
      [-0.04, 0, 0.04],
      [-0.02, 0, 0],
      [-0.04, 0, -0.04],
    ],
  ],
  [4, cycle(-0.24, 0.2)],
  [5, cycle(-0.16, 0.1)],
  [6, cycle(0.24, -0.2)],
  [7, cycle(0.16, -0.1)],
  [8, cycle(0.34)],
  [
    9,
    [
      [0.08, 0, 0],
      [0.38, 0, 0],
      [0.08, 0, 0],
      [0.02, 0, 0],
      [0.08, 0, 0],
    ],
  ],
  [10, cycle(-0.34)],
  [
    11,
    [
      [0.08, 0, 0],
      [0.02, 0, 0],
      [0.08, 0, 0],
      [0.38, 0, 0],
      [0.08, 0, 0],
    ],
  ],
]);
addAnimation(
  "ZombieRun",
  [0, 0.1625, 0.325, 0.4875, 0.65],
  [
    [
      1,
      [
        [-0.14, 0, -0.07],
        [-0.1, 0, 0],
        [-0.14, 0, 0.07],
        [-0.1, 0, 0],
        [-0.14, 0, -0.07],
      ],
    ],
    [4, cycle(-0.42, 0.34)],
    [5, cycle(-0.22, 0.14)],
    [6, cycle(0.42, -0.34)],
    [7, cycle(0.22, -0.14)],
    [8, cycle(0.58)],
    [
      9,
      [
        [0.12, 0, 0],
        [0.62, 0, 0],
        [0.12, 0, 0],
        [0.04, 0, 0],
        [0.12, 0, 0],
      ],
    ],
    [10, cycle(-0.58)],
    [
      11,
      [
        [0.12, 0, 0],
        [0.04, 0, 0],
        [0.12, 0, 0],
        [0.62, 0, 0],
        [0.12, 0, 0],
      ],
    ],
  ]
);

await io.write(outputPath, document);
console.log(`Wrote rigged zombie with ${bones.length} bones to ${outputPath}`);
