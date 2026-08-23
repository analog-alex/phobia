import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gltfTransform = resolve(root, "node_modules/.bin/gltf-transform");

const assets = [
  {
    label: "animated infected",
    input: "assests/Meshy_AI__0626205329_animated_source.glb",
    output: "assests/Meshy_AI__0626205329_animated_balanced.glb",
    ratio: "0.18",
    simplifyError: "0.01",
    textureSize: "1536",
  },
  {
    label: "animated acid infected",
    input:
      "assests/Meshy_AI_Neon_Plague_Chemist_0626210338_animated_source.glb",
    output:
      "assests/Meshy_AI_Neon_Plague_Chemist_0626210338_animated_balanced.glb",
    ratio: "0.14",
    simplifyError: "0.01",
    textureSize: "1536",
  },
  {
    label: "XMB H2 rifle",
    input: "assests/Meshy_AI_XMB_H2_Assault_Rifle_0703111155_texture.glb",
    output: "assests/Meshy_AI_XMB_H2_Assault_Rifle_0703111155_balanced.glb",
    ratio: "0.2",
    simplifyError: "0.01",
    textureSize: "1536",
  },
  {
    label: "droid grip hand",
    input: "assests/Meshy_AI_Droid_Grip_Hand_source.glb",
    output: "assests/Meshy_AI_Droid_Grip_Hand_balanced.glb",
    ratio: "0.28",
    simplifyError: "0.006",
    textureSize: "1024",
  },
  {
    label: "olive precision rifle",
    input: "assests/Meshy_AI_Olive_Drab_Precision__0703114333_texture.glb",
    output: "assests/Meshy_AI_Olive_Drab_Precision__0703114333_balanced.glb",
    ratio: "0.2",
    simplifyError: "0.01",
    textureSize: "1536",
  },
  {
    label: "facility waste compactor",
    input: "assests/Meshy_AI_Facility_Waste_Compactor_source.glb",
    output: "assests/Meshy_AI_Facility_Waste_Compactor_balanced.glb",
    ratio: "0.7",
    simplifyError: "0.01",
    textureSize: "1024",
  },
  {
    label: "chemical drum cluster",
    input: "assests/Meshy_AI_Chemical_Drum_Cluster_source.glb",
    output: "assests/Meshy_AI_Chemical_Drum_Cluster_balanced.glb",
    ratio: "0.7",
    simplifyError: "0.01",
    textureSize: "1024",
  },
  {
    label: "lab analyzer",
    input: "assests/Meshy_AI_Lab_Analyzer_source.glb",
    output: "assests/Meshy_AI_Lab_Analyzer_balanced.glb",
    ratio: "0.7",
    simplifyError: "0.01",
    textureSize: "1024",
  },
  {
    label: "containment pod",
    input: "assests/Meshy_AI_Containment_Pod_source.glb",
    output: "assests/Meshy_AI_Containment_Pod_balanced.glb",
    ratio: "0.7",
    simplifyError: "0.01",
    textureSize: "1024",
  },
  {
    label: "articulated lab arm",
    input: "assests/Meshy_AI_Articulated_Lab_Arm_source.glb",
    output: "assests/Meshy_AI_Articulated_Lab_Arm_balanced.glb",
    ratio: "0.7",
    simplifyError: "0.01",
    textureSize: "1024",
  },
  {
    label: "damaged security droid",
    input: "assests/Meshy_AI_Damaged_Security_Droid_source.glb",
    output: "assests/Meshy_AI_Damaged_Security_Droid_balanced.glb",
    ratio: "0.6",
    simplifyError: "0.012",
    textureSize: "768",
  },
  {
    label: "breached containment equipment",
    input: "assests/Meshy_AI_Breached_Containment_source.glb",
    output: "assests/Meshy_AI_Breached_Containment_balanced.glb",
    ratio: "0.6",
    simplifyError: "0.012",
    textureSize: "768",
  },
  {
    label: "abandoned emergency gear",
    input: "assests/Meshy_AI_Emergency_Gear_source.glb",
    output: "assests/Meshy_AI_Emergency_Gear_balanced.glb",
    ratio: "0.6",
    simplifyError: "0.012",
    textureSize: "768",
  },
  {
    label: "Aether medkit",
    input: "assests/Meshy_AI_Aether_Medkit_source.glb",
    output: "assests/Meshy_AI_Aether_Medkit_balanced.glb",
    ratio: "0.015",
    simplifyError: "0.025",
    textureSize: "1024",
  },
  {
    label: "ARMEX ammo crate",
    input: "assests/Meshy_AI_ARMEX_Ammo_Crate_source.glb",
    output: "assests/Meshy_AI_ARMEX_Ammo_Crate_balanced.glb",
    ratio: "0.006",
    simplifyError: "0.025",
    textureSize: "1024",
  },
];

const maxOutputBytes = 5 * 1024 * 1024;

if (!existsSync(gltfTransform)) {
  throw new Error(
    "Missing gltf-transform CLI. Run npm install or bun install first."
  );
}

for (const asset of assets) {
  const args = [
    "optimize",
    asset.input,
    asset.output,
    "--compress",
    "quantize",
    "--simplify",
    "true",
    "--simplify-ratio",
    asset.ratio,
    "--simplify-error",
    asset.simplifyError,
    "--texture-compress",
    "auto",
    "--texture-size",
    asset.textureSize,
    "--palette",
    "false",
  ];

  console.log(`Optimizing ${asset.label} asset...`);
  const result = spawnSync(gltfTransform, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to optimize ${asset.label} asset.`);
  }

  const size = statSync(resolve(root, asset.output)).size;
  const sizeMb = size / 1024 / 1024;
  if (size > maxOutputBytes) {
    throw new Error(
      `${asset.output} is ${sizeMb.toFixed(2)} MB, exceeding the 5 MB budget.`
    );
  }

  console.log(`${asset.output}: ${sizeMb.toFixed(2)} MB`);
}
