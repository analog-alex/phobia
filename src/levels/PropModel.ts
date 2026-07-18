import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

export interface PropPlacement {
  name: string;
  position: Vector3;
  scaling: Vector3;
  rotation?: Vector3;
}

export class PropModel {
  private constructor(
    private readonly scene: Scene,
    private readonly container: Awaited<
      ReturnType<typeof SceneLoader.LoadAssetContainerAsync>
    >
  ) {}

  static async load(
    scene: Scene,
    modelUrl: string,
    label: string
  ): Promise<PropModel | undefined> {
    try {
      await import("@babylonjs/loaders/glTF");
      const container = await SceneLoader.LoadAssetContainerAsync(
        "",
        modelUrl,
        scene
      );
      container.materials.forEach((material) => {
        material.freeze();
      });
      return new PropModel(scene, container);
    } catch (error) {
      console.warn(`Could not load ${label} model`, error);
      return undefined;
    }
  }

  instantiate(placement: PropPlacement, active: boolean): AbstractMesh[] {
    const entries = this.container.instantiateModelsToScene(
      (sourceName) => `${placement.name}-${sourceName}`,
      false
    );
    const root = new TransformNode(placement.name, this.scene);
    root.position.copyFrom(placement.position);
    root.scaling.copyFrom(placement.scaling);
    if (placement.rotation) root.rotation.copyFrom(placement.rotation);
    entries.rootNodes.forEach((node) => {
      node.parent = root;
    });

    const meshes = root.getChildMeshes();
    for (const mesh of meshes) {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.setEnabled(active);
    }
    return meshes;
  }
}
