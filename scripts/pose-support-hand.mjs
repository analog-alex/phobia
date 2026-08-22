import { NodeIO } from "@gltf-transform/core";
import { normals } from "@gltf-transform/functions";

const [inputPath, outputPath, directionArg = "-1"] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: bun scripts/pose-support-hand.mjs <input.glb> <output.glb> [direction]"
  );
}

const direction = Math.sign(Number(directionArg)) || -1;
const io = new NodeIO();
const document = await io.read(inputPath);
const positionAccessors = new Set();

for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute("POSITION");
    if (position) positionAccessors.add(position);
  }
}

const curlStartY = 0.34;
const curlEndY = 0.94;
const curlCenterZ = 0;
const maxCurlRadians = 2.75;
const point = [0, 0, 0];

for (const accessor of positionAccessors) {
  for (let index = 0; index < accessor.getCount(); index += 1) {
    accessor.getElement(index, point);
    const [x, y, z] = point;
    if (y <= curlStartY) continue;

    const linearT = Math.min(1, (y - curlStartY) / (curlEndY - curlStartY));
    const smoothT = linearT * linearT * (3 - 2 * linearT);
    const angle = direction * maxCurlRadians * smoothT;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const relativeY = y - curlStartY;
    const relativeZ = z - curlCenterZ;

    point[0] = x;
    point[1] = curlStartY + cos * relativeY - sin * relativeZ;
    point[2] = curlCenterZ + sin * relativeY + cos * relativeZ;
    accessor.setElement(index, point);
  }
}

await document.transform(normals({ overwrite: true }));
await io.write(outputPath, document);
