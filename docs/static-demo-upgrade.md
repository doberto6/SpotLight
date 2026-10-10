# Static mission guide, compressed demo and industrial structure

This report records the preceding 14-model iteration. See [the industrial reference pass](industrial-reference-pass.md) for the current ceiling, windows, piping, models, screenshots and measurements.

This iteration changes the existing local application directly. The supplied fictional floor-plan image and `src/facility-layout.mjs` remain the layout authority: room positions, all 15 waypoint registrations, estimated door openings and navigation collision footprints are preserved.

## Rendering diagnosis and fixes

The previous renderer built each partition as an independent box. Its lower trim reused the wall footprint inside the body, leaving coplanar side faces. Intersecting wall boxes also overlapped at corners and T junctions. Procedural columns and imported modular columns occupied the same perimeter positions. The floor was a zero-thickness shape, and world-coordinate UVs were multiplied by a repeat intended for normalized UVs, making concrete tiles excessively dense.

`facility-structure.mjs` unions wall footprint rectangles before emitting their boundary surfaces. Internal intersection faces disappear, caps occupy nonoverlapping strips, normals point outward, and UVs measure distance in scene metres. Wall thickness remains the registered 0.22 m. Lower and upper walls share an exact height boundary without overlapping side surfaces; roof modes can expose a clean section through the same rebuilt geometry. The floor is now a 0.2 m slab; wall bases extend 0.035 m into it. Coplanar trim and duplicate imported columns were removed. Concrete tiles use metre-based repeats, and the camera near plane increased from 0.08 to 0.18 m while retaining a 180 m far plane. Directional shadow normal bias decreased to 0.012 m. This addresses actual geometry, UV and depth issues rather than covering them with decoration.

## Ceiling and environmental changes

Steel columns occupy registered wall endpoints, keeping new ground details within existing wall clearance. Wall-head beams and bay frames connect to those columns; modular trusses use those support endpoints. The roof deck follows each floor's actual outline at 7.1 m, with aligned purlins and diagonal bracing. The clear structural height is approximately 6.4 m above the floor, allowing the existing machinery to fit below the service zone. Cable trays, process pipes, a separate fire main, ventilation ducts, threaded hangers and sealed luminaires use separate elevations. Suspension rods reach purlins or fixture beams. Truss, fixture and hanger components are instanced by floor and material.

Full roof shows upper walls and decking; Hidden removes overhead structure and upper walls; Cutaway retains the structural/service system while removing the roof deck and upper walls; Overhead selects the navigation camera and removes overhead obstructions. Top-down cameras automatically cut away roof geometry for navigation. Deck opacity and camera perspectives transition smoothly. Lights remain active when geometry is hidden to keep exposure consistent. Area lighting is mounted at four representative fixture bays, supplemented by emissive luminaires, hemisphere illumination, soft shadows and environment reflections. Contact AO adapts to slow devices. The articulated robot is retained; gait speed is capped during accelerated replay.

Equipment retains the existing pump, turbine, compressor, exchanger, vessel, transformer and control-cabinet GLBs. Concrete foundations, anchor bolts, service risers and electrical conduits integrate the equipment with overhead utilities. Existing pipe gallery grating, railings and ladder, battery racks, warehouse shelving and dock storage remain. Connections and structural dimensions are illustrative estimates; they are not engineering drawings.

## New Blender models

Generated through the live Blender connection and exported with metre units and glTF Y up. The original equipment scene was restored. The separate editable library is `art/spot-structure.blend`; its generator is `scripts/build-structural-assets.py`.

| Asset | Triangles | Material meshes | Bytes |
| --- | ---: | ---: | ---: |
| `public/models/structural/roof_truss.glb` | 908 | 2 | 60,856 |
| `public/models/structural/industrial_luminaire.glb` | 128 | 3 | 12,084 |
| `public/models/structural/pipe_hanger.glb` | 92 | 2 | 8,328 |

Total: 81,268 bytes, with no external textures. These are original project geometry; material and mesh instances share GPU resources. Existing compressor and heat-exchanger assets from the previous iteration remain available.

## Fixed mission route

The canonical recorded route is independent of the active playback clock. Existing obstacle-aware A* and validated corner smoothing run when a mission is loaded, with registered waypoint pairs cached. `static-mission-path.js` samples that route at approximately 0.55 m spacing. It creates one instanced dot mesh for each floor, uploads matrices once and computes bounds once. The dots use opaque, unlit white material at 0.035 m above the floor.

Animation never updates these matrices, colors, sizes, opacity or bounds. The complete guide is visible before playback. Progress appears on waypoint markers and the timeline. Floor selection and Show Mission Path only set mesh visibility. Historical, estimated-walk and compressed-demo clocks share the same canonical route, so mode changes do not recreate the scene. Mapping's Reset view now resets the camera without remounting the scene. The minimap also caches route coordinates once per mission, keeps its SVG elements mounted and toggles visibility without rebuilding them. A focused browser check after this final optimization verified unchanged SVG coordinates and DOM identities through seek, floor switching and toggling; the final production build passed.

Manual movement does not run route planning. Resume Mission computes one separate recovery path from the current pose to the next unfinished inspection, holds the source clock while traversing it, then continues playback. This path is never drawn as white dots and never replaces the mission guide. Explicit Return to Replay and scrubbing restore recorded positions; ordinary manual resume does not teleport.

The kit contains inspection waypoints but no surveyed walking route. The displayed guide is a deterministic simulated route between those records, not a claim that an actual robot walked those coordinates. No new physical inter-floor connector is invented: unsupported transfers remain explicitly labeled, with robot visualization hidden during the interval.

## Demo clock

Mission Replay defaults to a 75-second presentation at 1×. `buildDemo` retimes the existing nodes without editing source data or recomputing spatial routes. Each inspection gets a larger allocation than idle time; intervals containing recorded findings receive extra time; travel and unsupported transfers receive smaller allocations. Weights are normalized to 75 seconds. The recorded mission's final idle interval is retained so end-of-mission evidence remains reachable. Smooth travel easing reduces sudden acceleration at inspection boundaries.

The reversible `sourceTime` / `timelineTime` mapping keeps event rows, inspection arrivals, waypoint status and anomaly evidence synchronized. Original timestamp strings are unchanged. Recorded timing and the existing estimated 1.5 m/s walking mode remain selectable. Playback supports 1×, 2×, 4× and 8×, Play/Pause, Start, ±10 s, scrubbing, event jumps and manual resume. The demo clock uses elapsed wall time without a frame-duration cap; switching the browser tab pauses playback.

## Photographic reference and license

Inspected the user-specified [Wikimedia Commons power-station interiors category](https://commons.wikimedia.org/wiki/Category:Interiors_of_power_stations) and one high-resolution [Walchensee turbine-hall photograph](https://commons.wikimedia.org/wiki/File:Central_hidroel%C3%A9ctrica_de_Walchensee,_Kochel,_Baviera,_Alemania,_2014-03-22,_DD_04.JPG). Photograph: Diego Delso, [delso.photo](https://delso.photo), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), photographed March 22, 2014. The useful cues were pale walls, exposed framing, aligned machinery, enamel finishes, concrete foundations, elevated maintenance rails and organized service connections. The photograph was inspected as a reference only; it is not packaged as a texture, redistributed in this repository or used to change the fictional floor plan.

## Changed files in this iteration

- Geometry and materials: `src/facility-structure.mjs`, `src/replay-environment.js`, `src/plant-surfaces.js`.
- Paths, timing and controls: `src/static-mission-path.js`, `src/mission-markers.js`, `src/replay-engine.mjs`, `src/SpotReplayScene.jsx`, `src/MissionReplay.jsx`, `src/SpotMinimap.jsx`, `src/Facility3D.jsx`, `src/mission-replay.css`.
- Blender: `scripts/build-structural-assets.py`, `art/spot-structure.blend`, `public/models/structural/*.glb`, `public/models/structural/manifest.json`.
- Verification: `tests/static-demo.test.mjs`, `scripts/check-static-demo.cjs`, `scripts/capture-facility.cjs`, updated model counts in the existing browser scripts, `docs/screenshots/`, `docs/browser-static-demo-results.json`.
- Documentation: `README.md`, `docs/facility-simulation.md`, this report.

## Screenshots

Before: [walls](screenshots/before-walls.png), [overview](screenshots/before-overview.png).
After: [walls](screenshots/after-walls.png), [overview](screenshots/after-overview.png).
Roof controls: [full](screenshots/roof-full.png), [hidden](screenshots/roof-hidden.png), [cutaway](screenshots/roof-cutaway.png), [overhead navigation](screenshots/roof-overhead.png).

## Verification

Use Node 22 or later. `npm test` covers source joins and analytics, robot kinematics, asset budgets, every same-floor waypoint pair, collision-safe segment interiors, all missions' recorded arrivals, compressed-clock round trips, unchanged source records, immutable dot buffers and outward wall normals.

Browser checks use an external Playwright installation:

```sh
SPOT_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-static-demo.cjs
```

The script verifies matrix hashes, versions, identities, color and opacity across playback speeds, scrubbing, manual takeover, floor/camera/roof changes, fullscreen and mode switches. It also verifies the path toggle, mission-specific replacement, one recovery plan, all 15 accessible waypoint buttons, recorded anomaly readings, 14 successful GLB responses, mobile overflow and a complete 1× demo. Set `SPOT_SOFTWARE=1` to use software WebGL instead of the default hardware backend. Runtime statistics count all composer passes, including shadows and optional AO; triangle/draw-call counts are not unique model counts.

Final verification on October 10, 2026: all **29 Node 22 tests passed**, the production build passed, and `git diff --check` was clean. The Chrome acceptance suite passed with **14 GLBs**, no page errors or model warnings, no mobile horizontal overflow, and unchanged dot identities, matrix hashes/versions, color and opacity throughout every tested operation. A different mission produced a different saved guide. Manual movement performed no recovery planning; Resume Mission performed exactly one plan and preserved an incremental transition from the manual pose.

The complete M006 demo measured **75.033 seconds of wall time** at 1×. Over that replay, Chrome's **ANGLE Metal / Apple M3 Pro** backend averaged **60.01 FPS** at a 1450 × 1050 browser viewport. Average CPU render submission was **1.08 ms**; this is not a GPU timer measurement. At the final sampled view, renderer counters reported **220 draw calls** and **176,411 submitted triangles**, including all enabled composer passes. Counts vary with floor, camera, visible models and AO. The machine-specific result is recorded in [browser-static-demo-prior.json](browser-static-demo-prior.json), and does not guarantee 60 FPS on other devices. Before screenshots used software WebGL; no comparable before-performance benchmark was taken.

## Remaining limits

The source image does not establish precise wall heights, ceiling construction, dimensions, machinery connection points or inter-floor circulation. Those details are estimated. Compressed travel can exceed plausible robot ground speed and is labeled as a presentation demo; a normal-speed estimated simulation remains available. The scene is an interactive reconstruction, not a surveyed or photoreal engineering twin. GPU results depend on browser, resolution and device. The existing Vite large-bundle warning remains; the production build still works. No real robot commands are sent.
