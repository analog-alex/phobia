import type { WeaponKind } from "./WeaponSystem";

export type LevelPhase = "waste" | "sector7" | "complete";

export class RunProgression {
  phase: LevelPhase = "waste";
  selectedWeapon?: WeaponKind;

  get hasWeapon(): boolean {
    return this.selectedWeapon !== undefined;
  }

  get allowsWeaponAction(): boolean {
    return this.hasWeapon;
  }

  selectWeapon(kind: WeaponKind): boolean {
    if (this.selectedWeapon) return false;
    this.selectedWeapon = kind;
    return true;
  }

  canAscendWaste(wasteEnemyDead: boolean): boolean {
    return this.phase === "waste" && wasteEnemyDead;
  }

  ascendWaste(wasteEnemyDead: boolean): boolean {
    if (!this.canAscendWaste(wasteEnemyDead)) return false;
    this.phase = "sector7";
    return true;
  }

  canExtractSector(remainingHostiles: number): boolean {
    return this.phase === "sector7" && remainingHostiles === 0;
  }

  completeSector(remainingHostiles: number): boolean {
    if (!this.canExtractSector(remainingHostiles)) return false;
    this.phase = "complete";
    return true;
  }
}
