import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gltfTransform = resolve(root, "node_modules/.bin/gltf-transform");

const assets = [
  {
    label: "infected",
    input: "assests/Meshy_AI__0626205329_texture.glb",
    output: "assests/Meshy_AI__0626205329_balanced.glb",
    ratio: "0.18",
  },
  {
    label: "acid infected",
    input: "assests/Meshy_AI_Neon_Plague_Chemist_0626210338_texture.glb",
    output: "assests/Meshy_AI_Neon_Plague_Chemist_0626210338_balanced.glb",
    ratio: "0.14",
  },
  {
    label: "XMB H2 rifle",
    input: "assests/Meshy_AI_XMB_H2_Assault_Rifle_0703111155_texture.glb",
    output: "assests/Meshy_AI_XMB_H2_Assault_Rifle_0703111155_balanced.glb",
    ratio: "0.2",
  },
  {
    label: "olive precision rifle",
    input: "assests/Meshy_AI_Olive_Drab_Precision__0703114333_texture.glb",
    output: "assests/Meshy_AI_Olive_Drab_Precision__0703114333_balanced.glb",
    ratio: "0.2",
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
    "0.01",
    "--texture-compress",
    "auto",
    "--texture-size",
    "1536",
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
