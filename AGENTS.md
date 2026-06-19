# Phobia Development Guide

## Project Overview

Phobia is a desktop-first Babylon.js browser FPS built with Bun, Vite, and strict TypeScript. Preserve the fast classic-FPS controls, clinical sci-fi horror atmosphere, and stable 60 FPS target on integrated laptop graphics.

Read `docs/design.md` for gameplay and art direction. Use `docs/concept1.webp` as the visual reference.

## Commands

- Install dependencies: `bun install`
- Run locally: `bun run dev`
- Run tests: `bun test`
- Type-check and production build: `bun run build`
- Lint and format: `bun lint` (or `bun lint:fix`, `bun format`)

Before finishing code changes, run both `bun test` and `bun run build`.

## Architecture

- `src/main.ts`: lightweight title-screen bootstrap and lazy game loading.
- `src/core/Game.ts`: game loop, player input, weapon behavior, combat, and scene orchestration.
- `src/core/Enemy.ts`: infected geometry, animation, health, and AI behavior.
- `src/core/MaterialLibrary.ts`: shared materials. Do not create per-instance materials in gameplay code.
- `src/levels/Sector7.ts`: level construction, static batching, collision geometry, pickups, and facility lights.
- `src/systems/QualityManager.ts`: graphics presets and adaptive-quality behavior.
- `src/systems/AudioSystem.ts`: synthesized and cached game audio.
- `src/ui/`: HUD and F3 diagnostics.

## Engineering Conventions

- Keep TypeScript strict and use direct Babylon module imports.
- Reuse vectors and other temporary objects in per-frame code.
- Keep static geometry batched or thin-instanced by zone and material.
- Use simplified invisible collision meshes; visual decoration should not be collidable by default.
- Decorative meshes should be non-pickable. Mark only enemies, interaction targets, and impact surfaces pickable.
- Share and freeze materials after level construction.
- Preserve the 20 Hz enemy decision tick and 30 Hz grounded check unless a measured gameplay need justifies changing them.
- Prefer frame-driven animations over timers when pause/resume must freeze the action.
- Avoid repeated HUD DOM writes when values have not changed.
- Keep changes focused; do not replace the current procedural low-poly style with external assets without discussion.

## Performance Budget

- Target 60 FPS at 1920x1080 on integrated laptop graphics.
- Keep normal gameplay at or below 80 draw calls and six active point lights.
- Do not reintroduce `GlowLayer` or `DefaultRenderingPipeline`; bloom is the single emissive glow path.
- Pool short-lived effects such as bullet impacts.
- Preserve lazy loading so the title/bootstrap UI remains separate from the Babylon game chunk.
- Use the F3 overlay to inspect FPS, frame time, draw calls, active meshes, triangles, lights, render scale, and quality tier.

## Gameplay Invariants

- Movement speed, enemy count, and level layout should remain unchanged unless explicitly requested.
- Manual graphics presets override adaptation until Auto is selected again.
- Adaptive quality must not adjust while paused or loading.
- Reloading blocks firing and pauses with the game.
- High quality preserves the intended teal lighting, bloom, emissive screens, fog, and emergency accents.

## Visual Verification

After meaningful frontend or gameplay presentation changes, test the game in a browser when a local server is available. Check Start, pointer lock, pause/resume, movement, firing, reload, pickups, enemy combat, death, extraction, quality controls, and the F3 overlay as relevant to the change.
