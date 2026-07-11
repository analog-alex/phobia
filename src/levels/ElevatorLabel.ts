import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export function createElevatorLabel(
  scene: Scene,
  text: string,
  position: Vector3
): void {
  const texture = new DynamicTexture(
    `${text} elevator label texture`,
    { width: 1024, height: 192 },
    scene,
    false
  );
  texture.hasAlpha = true;
  texture.drawText(
    text,
    null,
    126,
    "bold 82px monospace",
    "#bfffee",
    "#071311",
    true,
    true
  );
  const material = new StandardMaterial(`${text} elevator label`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = new Color3(0.55, 1, 0.86);
  material.disableLighting = true;

  const label = CreatePlane(
    `${text} elevator label`,
    { width: 5.4, height: 1.02, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  label.position.copyFrom(position);
  label.material = material;
  label.isPickable = false;
  label.freezeWorldMatrix();
}
