# Phobia
## Design Document: Babylon.js Browser FPS MVP
**Version:** 1.0  
**Date:** June 10, 2026  
**Engine:** Babylon.js (with Bun runtime & TypeScript)  
**Genre:** First-Person Shooter (Classic FPS feel)  
**Target:** Browser (desktop-focused MVP)  
**Scope:** Minimum Viable Product (MVP) – Short playable level (~3-5 minutes)

---

## 1. Executive Summary / Vision

**Phobia** is a short, atmospheric first-person shooter prototype inspired by *Half-Life* (Black Mesa) and early *Quake* remakes. 

The player is a security operative or scientist caught in a containment breach at a modern experimental research facility (think Black Mesa meets Umbrella Corporation / Aperture Science aesthetics). Zombies and infected personnel have overrun sections of the lab.

**Core Fantasy:** Tense, claustrophobic exploration and combat in a high-tech but failing facility. Clean, clinical environments slowly give way to horror and chaos.

**MVP Goal:** Deliver a fully playable, polished-feeling short experience in the browser using Babylon.js + Bun. Prove the tech stack and core loop so it can be expanded into a longer demo or full short game.

Graphics target: Modernized low-to-mid poly with PBR materials, dynamic lighting, and post-processing. Not photorealistic AAA, but much higher fidelity and atmosphere than original Quake/Half-Life while keeping the fast, responsive classic FPS feel.

---

## 2. Game Overview

### Setting & Tone
- **Location:** "Aether Labs" – a secretive underground/experimental research complex.
- **Aesthetic:** Modern experimental facility.
  - Clean white/gray modular panels, glass, chrome, hazard yellow/black stripes.
  - Fluorescent and LED lighting (some flickering/broken).
  - Sci-fi monitors, holographic displays, containment chambers, server racks, labs with beakers/equipment.
  - Horror elements: Blood smears, overturned furniture, emergency lighting (red), breached doors, bodies.
- **Story Hook (MVP):** A "Resonance Cascade" style incident has released a mutagenic agent. Player must fight through the initial breach area to reach an extraction point or activate a lockdown.

### Genre & Gameplay Pillars
- **Classic FPS:** Mouse-look + WASD movement, instant weapon switching/feedback, satisfying gunplay.
- **Atmospheric Horror Shooter:** Tension from environment and enemy encounters rather than jump scares.
- **Exploration + Combat:** Short linear/semi-linear level with optional side paths for ammo/health.

### Target Experience
- 3–5 minute playtime for MVP.
- 4–6 zombie enemies total.
- 1–2 weapon types (starting with a pistol or SMG).
- Basic progression: Kill enemies → reach end trigger.

---

## 3. Tech Stack

| Component          | Choice                          | Reason |
|--------------------|----------------------------------|--------|
| Runtime / Dev      | **Bun**                         | Blazing fast TypeScript support, built-in bundler, excellent DX |
| 3D Engine          | **Babylon.js** (v7+)            | Superior game-oriented features vs Three.js: built-in physics options, materials, post-process, inspector, better FPS controller examples |
| Language           | **TypeScript**                  | Type safety for larger codebase |
| Physics            | Havok (preferred) or Ammo.js / Cannon.js | Havok is modern and performant in Babylon |
| Models / Assets    | GLTF / GLB (Blender export)     | Standard, supports animations, PBR |
| Input              | Babylon PointerLock + Keyboard  | Native support |
| UI / HUD           | HTML + CSS or Babylon GUI       | Simple overlay for health/ammo/crosshair |
| Audio              | Web Audio API or Howler.js      | Spatial audio possible in Babylon |
| Build / Serve      | Bun (dev server + bundle)       | One-command `bun run dev` |
| Hosting            | Static files (Netlify/Vercel) or simple Bun server | Easy browser deployment |

**Why Babylon.js over Three.js?**  
Babylon.js has more game-specific tooling (physics, particles, animation groups, inspector for debugging, better material system for PBR). There are existing open-source Babylon FPS demos and controllers that can be adapted quickly.

---

## 4. Core Gameplay Mechanics (MVP)

### Player
- First-person camera with smooth mouse look (sensitivity settings).
- Movement: WASD + Shift (sprint) + Space (jump, limited).
- Basic collision with level geometry.
- Health system (100 HP). Take damage from zombie attacks.
- Death → Restart level (simple).

### Weapons (MVP)
1. **Pistol / Handgun** (starting weapon)
   - Semi-automatic fire.
   - Limited ammo (reload mechanic or pickups).
   - Muzzle flash, recoil (simple camera kick), impact effects.
2. (Stretch) **Melee** or second weapon if time allows.

### Enemies: Zombies
- **Type:** Slow-to-medium speed humanoid infected.
- **Behavior (Simple AI):**
  - Detect player within range (line-of-sight or radius).
  - Chase player (direct path or basic navigation around obstacles).
  - Attack on close range (melee swipe animation + damage).
  - Health: 50–80 HP.
  - Death: ragdoll or simple animation + disappear or stay as corpse.
- **Variety (MVP):** 1–2 variants (normal + faster "runner" or armored).
- **Spawning:** Placed in level or triggered by player proximity/doors.

### Interactions
- Doors (some locked, some open automatically or require interaction).
- Pickups: Ammo crates, health packs (medkits glowing on floor).
- Environmental storytelling: Notes, broken monitors showing logs, containment breach announcements.

### Win Condition
- Reach the extraction elevator or activate the final console after clearing the area.

---

## 5. Level Design – MVP Level: "Sector 7 – Initial Breach"

**Theme:** Arrival / Security Checkpoint → Main Laboratory Corridor → Containment Lab → Breach Zone.

**Layout (Linear with minor branches):**
1. **Spawn / Security Checkpoint**
   - Player starts armed.
   - Flickering lights, emergency announcement playing.
   - First zombie encounter (1 enemy).

2. **Main Corridor**
   - Long hallway with side rooms (locked or optional).
   - 2–3 zombies.
   - Ammo and health pickups.
   - Broken glass, blood trails leading forward.

3. **Research Lab**
   - Larger room with workbenches, computers, containment pods.
   - 2 zombies (one hidden or behind cover).
   - Environmental hazards (minor – sparking panels).

4. **Breach / Extraction**
   - Final area with more destruction.
   - Last 1–2 zombies.
   - Objective console or elevator to "escape".

**Length:** ~150–250 meters of traversable space.  
**Poly Budget:** Keep total scene reasonable for browser (aim < 100k–200k triangles visible).

**Lighting:** Dynamic point/spot lights + shadows where performant. Baked lightmaps for static areas + real-time for key dynamic elements.

---

## 6. Art Direction & Graphics

**Overall Style:** Modern clean sci-fi with horror decay. High attention to material quality (PBR) and lighting to sell the "premium retro-FPS" feel.

**Key Visual References:**
- Black Mesa interiors (labs, corridors, hazard stripes).
- Clean modern research facilities with clinical lighting.
- Subtle decay and chaos.

**Technical Graphics Features (Babylon.js strengths):**
- PBR materials (metallic, roughness, normal maps, emissive for screens).
- Image-based lighting + HDR environment.
- Dynamic shadows (cascaded or simple).
- Post-processing: Bloom (for lights/monitors), slight vignette, film grain or chromatic aberration for atmosphere, depth of field (subtle).
- Particle systems: Muzzle flash, bullet impacts, blood (simple), dust in lights.
- Animated elements: Flickering lights, rotating fans, monitor screens with simple shaders or textures.

**Models:**
- Level: Modular kit (walls, floors, ceilings, props) built in Blender → GLTF.
- Weapons: Low-mid poly with good textures.
- Zombies: Simple rigged humanoid (or use free assets). Basic walk/attack/idle animations.
- Props: Computers, chairs, beakers, servers, barrels, etc.

**Performance Target:** 60 FPS on mid-range desktop/laptop in Chrome/Edge. Mobile as bonus (lower settings).

---

## 7. Audio Design

**Priorities for MVP:**
- Footsteps (surface-aware if possible).
- Weapon fire + reload sounds.
- Zombie groans, attack grunts, death sounds.
- Ambient facility hum, alarms, distant screams.
- UI feedback (pickup, hitmarker).

Use spatial audio where Babylon supports it. Simple 2D mix for MVP is acceptable.

---

## 8. User Interface / HUD

Minimalist classic FPS style:
- Crosshair (dynamic – expands on movement/fire).
- Health bar or numeric (bottom left).
- Ammo count (bottom right).
- Simple objective text or waypoint if needed.
- Pause menu (ESC) with settings (sensitivity, volume, graphics quality).

Implemented via HTML overlay or Babylon GUI for consistency.

---

## 9. Controls

| Action          | Input                  |
|-----------------|------------------------|
| Move            | WASD                   |
| Look            | Mouse                  |
| Shoot           | Left Mouse Button      |
| Reload          | R                      |
| Sprint          | Shift                  |
| Jump            | Space                  |
| Interact        | E                      |
| Pause/Settings  | ESC                    |
| Weapon Switch   | 1 / Scroll Wheel       |

Pointer Lock on click to enter FPS mode.

---

## 10. Technical Architecture

### Project Structure (Bun + TypeScript)
```
facility-breach/
├── src/
│   ├── core/
│   │   ├── Game.ts              # Main game loop, scene setup
│   │   ├── PlayerController.ts  # FPS movement + camera
│   │   ├── Weapon.ts
│   │   └── Enemy.ts
│   ├── levels/
│   │   └── Sector7.ts           # Level loading, spawners
│   ├── systems/
│   │   ├── Physics.ts
│   │   ├── Input.ts
│   │   └── Audio.ts
│   ├── assets/                  # GLTF paths, textures
│   └── ui/
│       └── HUD.ts
├── public/                      # Static assets (models, textures, sounds)
├── package.json (Bun)
└── tsconfig.json
```

### Key Systems
- **Scene Management:** Single scene with multiple meshes. Load GLTF with `SceneLoader`.
- **Player Controller:** Use Babylon's `UniversalCamera` or community FPS controller examples. Attach physics impostor if using full physics.
- **Physics:** Enable Havok physics plugin. Static level meshes as colliders. Dynamic for player/enemies/projectiles.
- **Enemy AI:** Simple state machine (Idle → Chase → Attack). Use `Vector3` distance checks + raycasts for LOS.
- **Combat:** Raycast from camera for shooting. Apply damage on hit. Simple projectile or hitscan.
- **Optimization:** Frustum culling, LOD if needed, mesh instancing for repeated props, texture atlasing.

**Babylon Inspector:** Enable in dev for debugging scene, materials, physics.

---

## 11. Asset Pipeline

1. Model in **Blender** (low-mid poly, good UVs).
2. Bake or paint PBR textures (Substance Painter or Blender).
3. Export as **GLTF/GLB** with animations.
4. Import in Babylon with `SceneLoader.ImportMeshAsync`.
5. Optimize: Draco compression, texture compression (KTX2/Basis), mesh simplification where appropriate.

**Free/Placeholder Sources (MVP):**
- Kenney.nl or similar asset packs.
- Sketchfab (free downloadable models).
- Mixamo for zombie animations (if humanoid).
- Procedural simple geometry + basic materials for early prototypes.

---

## 12. Development Roadmap & Milestones

**Phase 1 – Foundation (1–2 weeks)**
- Bun + Babylon.js project setup with TypeScript.
- Basic scene + FPS camera controller (WASD + mouse look + pointer lock).
- Simple box/cylinder level geometry + collision.
- Basic shooting (raycast) + placeholder enemy.

**Phase 2 – Core Loop (1–2 weeks)**
- Import first GLTF level section.
- Player health, damage, death/restart.
- Zombie AI + animations.
- Weapon with ammo + reload.
- Pickups.

**Phase 3 – Polish & Atmosphere (1 week)**
- Lighting, shadows, post-processing.
- Sound integration.
- HUD and basic UI.
- Second half of level + more enemies.
- Performance tuning + testing on different devices.

**Phase 4 – MVP Delivery**
- Final tweaks, bug fixing.
- Build with Bun and deploy (static site).

**Stretch Goals (post-MVP):**
- Multiple weapons.
- Better AI (flanking, groups).
- More levels or procedural elements.
- Multiplayer (simple deathmatch using WebSockets).
- VR support (Babylon has good XR).

---

## 13. Risks & Mitigations

| Risk                        | Likelihood | Impact | Mitigation |
|-----------------------------|------------|--------|----------|
| Performance on lower-end devices | Medium    | High   | Aggressive optimization, quality settings, test early |
| Complex AI / pathfinding    | Medium    | Medium | Keep AI very simple for MVP; use direct chase + raycast |
| Asset creation time         | High      | Medium | Use modular kits + free assets heavily |
| Physics jank (FPS feel)     | Medium    | High   | Leverage existing Babylon FPS community examples |
| Browser compatibility       | Low       | Low    | Target modern Chrome/Edge/Firefox; WebGL2+ |

---

## 14. Success Criteria for MVP

- Player can move, look, and shoot smoothly.
- At least 4–6 zombies can be encountered and killed.
- Level is fully traversable with clear start → end.
- Runs at stable 60 FPS in browser on mid-range hardware.
- Atmospheric lighting and sound sell the facility horror vibe.
- Code is clean and extensible (TypeScript + good structure).

---

## 15. Next Steps After MVP

- Expand level into full short experience.
- Add story elements (voice logs, more environmental storytelling).
- Introduce new enemy types and weapons.
- Consider full game or episodic release.
- Explore WebGPU backend in Babylon for future-proofing.

---

**Document prepared for rapid prototyping with modern web tech.**  
This stack (Bun + Babylon.js) gives excellent developer experience and strong performance for browser-based 3D games while keeping bundle sizes reasonable.

Ready to start building? The next step would be initializing the Bun project and setting up the basic FPS controller scene.

*End of Design Document v1.0*
