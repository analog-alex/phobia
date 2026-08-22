# Phobia Development Guide

## Project Overview

Phobia is a desktop-first Babylon.js browser FPS built with Bun, Vite, and strict TypeScript. Preserve the fast classic-FPS controls, clinical sci-fi horror atmosphere, procedural low-poly facility style, and stable 60 FPS target on integrated laptop graphics.

Read `docs/design.md` for gameplay and art direction. Use `docs/concept1.webp` as the visual reference.

The current run starts in Level 08 // Waste Disposal, then ascends to Level 07 // Sector 7. The player begins unarmed, chooses one weapon beside the first lift, clears both facility sections, and authorizes extraction.

## Commands

- Install dependencies: `bun install`
- Run locally: `bun run dev`
- Preview a production build: `bun run preview`
- Run tests: `bun test`
- Type-check and production build: `bun run build`
- Lint and format: `bun lint` (or `bun lint:fix`, `bun format`)
- Rebuild balanced GLB assets: `bun run assets:optimize`

`bun run build` runs `tsc --noEmit` followed by `vite build`. Before finishing code changes, run `bun lint`, `bun test`, and `bun run build`. The pull-request CI runs the same checks after `bun install --frozen-lockfile`.

Run `assets:optimize` only when source GLBs change. It uses `gltf-transform` to produce the runtime `*_balanced.glb` files in `assests/`; the script enforces a 5 MB maximum per output.

## Architecture

- `index.html`, `src/main.ts`, and `src/style.css`: title screen, controls, lazy game bootstrap, intro sequence, pause/settings screen, HUD layout, and end screen. `main.ts` preloads the game module during idle time, initializes the game after Start, and shows the intro over the initialized game before it dissolves.
- `src/core/Game.ts`: Babylon scene setup, post-processing, lifecycle, pointer lock, phase transitions, combat, interactions, pickups, audio/effects coordination, and quality application. Keep it as orchestration rather than moving level geometry into it.
- `src/core/PlayerController.ts`: camera configuration, WASD/sprint movement, collision capsule, ground probing, jump buffering, gravity, and vertical motion.
- `src/core/Enemy.ts`: infected variants (`infected`, `runner`, `acid`), model replacement with procedural fallback, health/death state, animation, melee AI, and acid attacks.
- `src/core/WeaponSystem.ts`: XMB H2 and A7 Bolt Rifle profiles, bundled model loading with procedural fallbacks, first-person droid hands, weapon pickup placement, firing stats, reload animation/state, weapon bob/kick, and muzzle light.
- `src/core/RunProgression.ts`: the run state machine (`waste` -> `sector7` -> `complete`) and one-time weapon selection gates. Keep progression rules testable here.
- `src/core/MaterialLibrary.ts`: shared PBR/emissive materials and cached enemy material sets. Do not create per-instance gameplay materials.
- `src/levels/FacilityLevel.ts`: common level contract for enemy spawns, activation, updates, and light budgets.
- `src/levels/WasteDisposal.ts`: Level 08 opening area, weapon pedestals, disposal machinery, first infected, and the lift to Sector 7.
- `src/levels/Sector7.ts`: Level 07 facility geometry, static batching, collision geometry, pickups, six enemy spawns, extraction lift, and facility lighting.
- `src/levels/ElevatorBuilder.ts` and `src/levels/ElevatorLabel.ts`: shared lift geometry, interaction console, hazard markings, and generated labels used by both levels.
- `src/systems/Batcher.ts`: thin-instance batching of static boxes by zone, material, and pickability.
- `src/systems/FacilityLighting.ts`: distance-based active-light selection, flicker, and per-level light budgets.
- `src/systems/QualityManager.ts`: persisted Auto/Low/Medium/High presets and adaptive render-quality behavior.
- `src/systems/Effects.ts`: pooled bullet impacts and acid projectiles.
- `src/systems/AudioSystem.ts`: synthesized Web Audio effects, ambient hum, and pause-safe delayed sounds.
- `src/ui/HUD.ts`: cached HUD updates, dynamic standing crosshair, objective/prompt/message state, hitmarker, damage flash, health, and weapon/ammo display.
- `src/ui/Diagnostics.ts`: F3 overlay for frame timing, FPS, draw calls, active meshes, triangles, active lights, render scale, and quality tier.
- `src/config/constants.ts`: gameplay, weapon, enemy, effects, level, timing, and graphics tuning values.
- `src/types/index.ts`: lightweight Babylon metadata tags and type guards.
- `scripts/optimize-enemy-assets.mjs`: reproducible GLB optimization for infected, weapon, and droid hand assets.

Bundled models live under the intentionally named `assests/` directory. Runtime code should load the balanced GLBs and freeze their imported materials; retain procedural fallbacks so a missing model does not prevent the game from starting.

The first-person droid hands are one unrigged, permanently closed fist model (`Meshy_AI_Droid_Grip_Hand_balanced.glb`) loaded once and used twice: the support hand is the trigger hand mirrored by a negative X scale. Because the fingers cannot be bent, each hand is posed by aiming two model axes instead — local `+Z` runs wrist to fist, and local `+Y` is the channel the curled fingers wrap, so aligning `+Y` with a grip closes the fist around it. Per-weapon `WEAPON.<KIND>.HANDS` entries in `src/config/constants.ts` hold those directions plus a grip position in weapon model space; `WEAPON.HANDS.GRIP_PIVOT` shifts the model so those positions read as grip points rather than wrist points. Do not try to curl the fingers by transforming vertices.

## Engineering Conventions

- Keep TypeScript strict, use direct Babylon module imports, and follow Biome formatting/import ordering.
- Reuse vectors, rays, matrices, and other temporary objects in per-frame code. Prefer squared-distance checks where no actual distance is needed.
- Keep static geometry batched or thin-instanced by zone and material. Build simplified invisible collision meshes separately; visual decoration should not be collidable by default.
- Keep decorative meshes, weapon visuals, labels, pickups' hidden trigger meshes, and impact effects non-pickable. Mark only enemies, interaction targets, and collision surfaces needed by raycasts pickable.
- Use the metadata type guards in `src/types/index.ts` for enemy, collision, pickup, and extraction checks instead of ad-hoc string metadata.
- Share and freeze materials after level construction. Cache enemy material sets by variant. Generated elevator labels are a deliberate special case because each label owns a dynamic texture/material.
- Preserve the current frame-driven update model. Gameplay systems update only while the run is active; pause and loading must freeze movement, enemies, effects, audio scheduling, and adaptive-quality accumulation.
- Preserve the 10 Hz enemy decision tick, 20 Hz grounded check, 33 ms frame-delta cap, and jump buffer unless a measured gameplay need justifies changing them.
- Prefer frame-driven animations over timers when pause/resume must freeze the action. This includes enemy death, weapon bob/kick/reload, pickups, doors, and pooled effects.
- Avoid repeated HUD DOM writes when values have not changed; update diagnostics at its existing throttled cadence.
- Keep level implementations behind `FacilityLevel`, deactivate inactive level meshes/lights, and update only the enemies and acid projectiles belonging to the active phase.
- Keep changes focused and preserve the procedural low-poly style. Do not replace bundled/procedural presentation with new external runtime assets without discussion.

## Gameplay Invariants

- The run starts at `(0, PLAYER.HEIGHT, -116)` in Waste Disposal with no usable weapon. Walking within the weapon pickup radius automatically selects exactly one weapon; the other weapon is disabled and there is no mid-run weapon switch.
- XMB H2 uses a 12-round clip, 48 starting reserve, 34 damage, 80-unit range, and 0.82-second reload. A7 Bolt Rifle uses a one-round chamber, 10 starting reserve, 115 damage, 145-unit range, and 1.18-second reload. Keep these values in `src/config/constants.ts` and weapon profiles consistent.
- Firing and reloading are blocked until a weapon is selected. Reloading blocks firing, and paused gameplay must not advance the reload timer or weapon animation.
- Waste Disposal has one infected and must be cleared before `[ E ] ASCEND TO SECTOR 7` is enabled. Ascending deactivates Waste Disposal, activates Sector 7, places the player at its entrance, and enables the six Sector 7 enemies.
- Sector 7 extraction remains locked until all six active-sector hostiles are neutralized. The existing total enemy count and level layouts should not change unless explicitly requested.
- Preserve movement speeds (`8.5` walk, `13` sprint), jump behavior, collision capsule, pickup effects, acid combat, and the classic mouse/pointer-lock control feel unless explicitly requested.
- The droid hands are cosmetic. They attach to the acquired weapon's model-space node so they inherit bob, kick, and reload motion, stay hidden until a weapon is acquired so pickups never show floating arms, and a hand model that fails to load must leave the weapon fully playable. The hand model ends in a flat cut, so weapon view poses and `modelScale` are tuned to sit close enough to the camera that both forearms run off the bottom of the frame; a pose that exposes those cuts reads as severed arms. `WEAPON.RELOAD_DIP` is tuned against those poses too, so re-check the reload dip whenever the framing moves.
- Keep the current controls: `WASD` move, `Shift` sprint, `Space` jump, mouse aim/LMB fire, `R` reload, `E` interact with lifts, `Esc` pause/resume, and `F3` diagnostics. Do not reintroduce the removed mid-run weapon-switch action without an explicit design decision.
- Enemy variants retain their current roles: infected melee, faster runner melee, and acid ranged attacker. Acid projectiles are simulated and updated only during Sector 7.
- Manual graphics presets override adaptation until Auto is selected again. Adaptive quality must not adjust while paused, loading, or between level phases.

## Performance Budget

- Target 60 FPS at 1920x1080 on integrated laptop graphics.
- Use `Batcher`/thin instances for repeated static geometry and keep collision meshes simple. Deactivate inactive level geometry and lights rather than updating both facilities during play.
- Facility dynamic-light budgets are Low `1`, Medium `2`, and High `3`; a muzzle flash temporarily asks the active level to reserve one fewer facility-light slot when possible. Keep the ambient light and transient muzzle light separate from facility-light selection.
- Do not reintroduce `GlowLayer` or `DefaultRenderingPipeline`. The custom post-process pipeline uses bloom as the primary emissive glow path, with FXAA and optional chromatic aberration controlled by quality settings. Bloom is enabled only on the High preset.
- Pool short-lived effects: the current budgets are 16 impact meshes and 6 acid projectiles. Do not allocate impact/projectile meshes during combat.
- Preserve lazy loading so the title/bootstrap UI remains separate from the Babylon game chunk, while idle preloading may warm the game module before Start.
- Keep optimized runtime GLBs within the 5 MB per-asset budget enforced by `scripts/optimize-enemy-assets.mjs`.
- Use F3 to inspect FPS, average/p95 frame time, draw calls, active meshes, triangles, active lights, render scale, and quality preset/tier when tuning performance.

## Visual Verification

After meaningful frontend or gameplay presentation changes, test the game in a browser when a local server is available. Check Start, the intro hold/click skip, pointer lock, pause/resume, movement, sprint/jump, weapon selection, firing, reload, pickups, Waste Disposal combat, elevator gating, Sector 7 combat including acid attacks, extraction, death, quality controls, and the F3 overlay as relevant to the change.
