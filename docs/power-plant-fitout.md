# Power plant room fitout and recorded inspection targets

This pass enhances the existing simulation without changing the registered layout, waypoint coordinates, collision envelopes, mission data or image-based Mapping view. The 75-second default demo and 1.8 m/s walking mode remain available.

## Added details

- All 15 bays receive a room identification/warning plaque, fasteners, a ventilation grille with louvres, a wall service connection and distinct operational labels. Signs remain visible in cutaway view; fixtures on the upper wall follow roof visibility.
- Seven access/mechanical bays receive wall-mounted extinguishers above the walking envelope. Eighteen existing wall gaps receive framed jambs, overhead lintels and emergency fixtures. Door openings stay open; jambs lie inside the existing wall rectangles.
- Machinery pads receive supported gauges and service disconnects. The visual review added foundation-mounted stanchions beneath the disconnect enclosures. Existing hot-service risers receive insulation sleeves and metal retaining bands. The gauges are environmental detail; their decorative needles are not live readings.
- Both turbine bays receive parked bridge hoists and rails suspended from existing perimeter framing. Hooks remain above the four-metre machinery envelope. The crane placement avoids the overhead service runs and needs no new floor columns.
- The maintenance pad receives a workbench with drawers, a vice, hanging tools and parts storage between the existing carts. The visual review corrected its orientation to face the working aisle. Spare-parts shelves receive neatly arranged pipe sections and cable reels. Four machinery cooling fans animate behind fixed guards; their motion is cosmetic and does not represent sensor telemetry.
- The switchgear bay has a mission monitor driven by the same mission ID, virtual robot floor/destination, replay progress and encountered finding count as the dashboard.

Existing pump skids, turbine/generator assemblies, pressure vessels, cabinets, transformer, compressor, heat exchanger, foundations, drains, service manifolds, trusses, cable trays, lighting and PBR floor maps are reused.

## Inspection workflow

Enable **View options → Inspection targets** to select an equipment target in the scene. Alternatively, choose a waypoint and select its equipment in **Inspection assets**. The overlay is off by default and only the selected asset receives a floating label.

Targets use catalog IDs and actual recorded asset/location pairs. Where the synthetic kit records an action at a location different from the catalog, both source contexts are preserved. M006 has 20 targets. The asset panel shows readings for the latest action available at the current source time, recorded findings, quality and timestamps. **Jump to recorded inspection** scrubs the existing replay. Seeking backward hides future readings and findings. A successful navigation action is marked visited rather than inspected. A failed action requests review rather than diagnosing a machinery fault.

No readings, operating ranges, anomalies or mission records are fabricated. The supplied kit does not define physical operating limits. Existing historical baseline analysis remains available elsewhere in the dashboard. This pass adds no hardware control or persistence backend.

## Assets and implementation

| Original Blender asset | Download size | Triangles | Placement |
| --- | ---: | ---: | --- |
| Maintenance workbench | 183,296 bytes | 2,920 | Existing WP15 maintenance pad |
| Bridge hoist | 76,900 bytes | 1,232 | Reused in WP08 and WP09 |

Both assets are CC0, with explicit licensing in `public/models/fitout/LICENSE.md`. `art/spot-room-fitout.blend` preserves editable source; `scripts/build-room-fitout.py` exports an isolated metric scene and restores the user's active Blender scene. Existing model/texture attribution is retained.

The Manapouri and Walchensee photographs in `references/architecture` were reviewed for clear maintenance aisles, supported lifting equipment, orderly electrical/service infrastructure and restrained wear. Their original attributions are in [references/README.md](../references/README.md). The supplied [power-station interior collection](https://commons.wikimedia.org/wiki/Category:Interiors_of_power_stations) was also inspected. These photographs inform architecture only and are not inspection evidence.

Primary changed files: `src/room-fitout.mjs` defines placement and room identities; `src/plant-fitout.js` creates the fixtures and live mission screen; `src/replay-environment.js` batches geometry and imports the new GLBs. `src/inspection-assets.mjs` resolves source targets/readings; `src/inspection-markers.js` renders optional selection markers. `src/SpotReplayScene.jsx`, `src/MissionReplay.jsx` and `src/mission-replay.css` connect selection to the existing replay and sidebar.

## Validation and performance

- All **46 Node 22 tests** pass, including new wall/frame placement, GLB budget, every mission's target IDs, and temporal evidence checks. Production build passes; its pre-existing large-bundle warning remains.
- All **15 rooms** were reached at their recorded arrivals and captured in chase and overhead views. The white hitbox remained clear. Room checks also verify hitbox toggles and mobile overflow.
- Actual WebGL target clicks, source readings, a recorded anomaly, jump-to-inspection, rewinding and optional marker visibility pass the inspection browser check. Route buffer identities/hashes stay unchanged.
- The full **M006 75-second replay completed in 75.012 seconds**, with no sampled collision failures, page errors or asset warnings. Manual motion, stop, single-plan rejoin, roof/camera modes, fullscreen and mobile layout pass. All 19 GLBs load.
- On Chrome/ANGLE Metal, Apple M3 Pro, viewport 1450 × 1050: **60.01 FPS**, **1.62 ms average CPU render submission**, 311 renderer calls and 334,237 submitted triangles in the measured scene. The preceding collision pass measured 60.01 FPS, 1.51 ms, 296 calls and 302,321 triangles. The full-run measurements preceded the final workbench orientation and disconnect-post corrections; focused room checks verify those final placements without changing navigation geometry. These are browser CPU/renderer measurements, not GPU timer results or guarantees for other devices. Adaptive AO can disable its optional pass on slower devices.

Repeated grilles, bolts, frames, instrumentation, insulation and storage props share materials and instance batches. The two new GLBs add about 254 KiB combined. One sign atlas and one small mission-monitor canvas are used; monitor uploads happen only when its displayed state changes. Four fan rotors reuse merged blade geometry; only visible floor rotors animate. Existing resource disposal handles the new geometry, textures and materials.

Results: [replay/performance](browser-fitout-replay-results.json), [room arrivals](browser-room-fitout-results.json), [inspection interaction](browser-inspection-assets-results.json), [workshop approach](browser-workshop-detail-results.json), [instrument support corrections](browser-instrument-support-results.json). Reproduce with `scripts/check-static-demo.cjs`, `scripts/inspect-industrial-rooms.cjs` and `scripts/check-inspection-assets.cjs`, supplying `SPOT_PLAYWRIGHT_MODULE` for an external Playwright installation. Node 22 is required for kit CSV tests/imports.

## Scope choices

The supplied map has two disconnected indoor floor plates and no exterior yard, central control-room floor space, HRSG hall or walkable upper deck. This pass therefore adds a compact mission monitor, turbine lifting gear and workshop fitout inside existing bays. It does not invent a full outdoor combined-cycle plant, an HRSG building, extra floors or a connection between the floor plates. Such additions would need a layout revision and new navigable/collision geometry. Large turbine/pump models were already suitable and were reused instead of replaced. No paid asset generator or newly downloaded model was needed.

## Screenshots

[Turbine bay, overhead](screenshots/fitout-room-WP08-plan.png) · [Electrical bay](screenshots/fitout-room-WP02.png) · [Workshop, overhead](screenshots/fitout-room-WP15-plan.png) · [Workshop, manual approach](screenshots/fitout-workshop-detail.png) · [Storage, overhead](screenshots/fitout-room-WP13-plan.png) · [Selected equipment and source readings](screenshots/fitout-inspection-target.png).

All 15 overhead views and representative chase views were visually reviewed for placement, support contact, overlap and clear walking areas; comparisons use the original room captures and the architectural references. All 30 room captures use `screenshots/fitout-room-WP01` through `WP15`, with `-plan` for overhead views. Prior `collision-room-*` captures are retained for comparison.
