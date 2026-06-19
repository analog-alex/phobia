import type { Material } from "@babylonjs/core/Materials/material";
import {
  Matrix,
  Quaternion,
  type Vector3,
} from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

interface BatchEntry {
  material: Material;
  matrices: Matrix[];
  pickable: boolean;
}

/**
 * Reusable thin-instance batcher for static level geometry.
 * Groups by (zone:material:pickable) to minimize draw calls.
 */
export class Batcher {
  private readonly batches = new Map<string, BatchEntry>();

  batch(
    zone: string,
    size: Vector3,
    position: Vector3,
    material: Material,
    pickable = false,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0
  ): void {
    const key = `${zone}:${material.uniqueId}:${pickable}`;
    let entry = this.batches.get(key);
    if (!entry) {
      entry = { material, matrices: [], pickable };
      this.batches.set(key, entry);
    }
    entry.matrices.push(
      Matrix.Compose(
        size,
        Quaternion.RotationYawPitchRoll(rotationY, rotationX, rotationZ),
        position
      )
    );
  }

  flush(scene: Scene): void {
    this.batches.forEach((entry, key) => {
      const mesh = CreateBox(key, { size: 1 }, scene);
      mesh.material = entry.material;
      mesh.isPickable = entry.pickable;
      mesh.freezeWorldMatrix();
      this.setThinMatrices(mesh, entry.matrices);
    });
    this.batches.clear();
  }

  private setThinMatrices(mesh: Mesh, matrices: Matrix[]): void {
    const buffer = new Float32Array(matrices.length * 16);
    for (let index = 0; index < matrices.length; index++) {
      matrices[index].copyToArray(buffer, index * 16);
    }
    mesh.thinInstanceSetBuffer("matrix", buffer, 16, true);
    mesh.thinInstanceRefreshBoundingInfo(true);
  }
}
