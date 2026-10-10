# Reference-based SPOT facility simulation

The current rendering upgrade is documented in [industrial-reference-pass.md](industrial-reference-pass.md); the static-path and timing implementation is documented in [static-demo-upgrade.md](static-demo-upgrade.md). The verification section below records the earlier environment iteration; current measurements and screenshots are in the new report.

The simulation reconstructs the **Fictional Facility Floor Plan – Waypoint Locations (WP01–WP15)** supplied in `data/.../04_ASSETS/fictional_floor_plan.png`. It preserves the two separately drawn floors, Floor 1's entrance/courtyard indentation, the central pipe gallery, the upper pump/compressor rooms, the two lower turbine halls, and Floor 2's battery/exchanger, warehouse/auxiliary, and inspection-dock arrangement. This is an estimated reconstruction, not a surveyed architectural digital twin.

## Coordinates and placement

`src/facility-layout.mjs` is the sole waypoint/room registration. Image coordinates are percentages of the **entire** two-floor reference. Three.js uses Y up and the conversion `x = (imageX - 50) × 0.8`, `z = (imageY - 50) × 0.45`; the inverse drives the live 2D minimap. The scene spans roughly 80 × 45 estimated metres. Floor 2 stays separate, beside Floor 1 as presented in the drawing; side-by-side presentation does not imply a physical adjacency or connecting passage.

All 15 marker locations follow the printed pins rather than the unrelated CSV x/y fields. Location names, zone types, floor numbers, actions, readings, and anomalies come from the existing dataset. Access is blue, Electrical yellow, Process green, Mechanical purple; WP05 retains the red reference marker while remaining Process. Room rectangles and perimeter polygons share this registration. Machinery pads stay inside their designated rooms with clearance around inspection pins. Door openings are estimated from visible breaks; their exact dimensions and connectivity cannot be established from the raster image alone.

Both Mapping's 3D overview and Mission Replay now use `SpotReplayScene` and `createReplayEnvironment`. The replay minimap overlays the actual same route and robot pose on the original image. Floor and waypoint selections persist between Mapping and Replay. Mapping retains event-step controls; elapsed-time replay has its own mission clock.

## Routes, progress and control

A* searches a 0.4 m grid inside the floor polygons, using the same 0.65 m robot clearance and equipment/partition rectangles as manual control. Diagonal moves, shortcut smoothing, and rounded corners validate complete segments against expanded collision rectangles; a route never falls back to a straight line through an obstacle. Dots are sampled every 0.55 m at floor level and rendered using an `InstancedMesh`. SPOT samples that exact path by cumulative distance. The full route stays white and static even before playback; Show Mission Path and floor selection only change visibility. Destinations pulse, completed inspections receive checkmarks, and encountered recorded anomalies tint markers red. WP05's normal red reference color is not itself an anomaly.

The default compressed demo lasts 75 seconds, with separate source and demo clocks. Historical replay uses original inspection timestamps and dwell durations. Automated simulation uses the same inspection order at an estimated 1.5 m/s, with inspection pauses capped at 30 simulated seconds. A reversible time mapping retains original evidence timestamps and prevents simulated timing from being presented as measured telemetry. The first recorded waypoint supplies the starting pose because the source mission-start event contains no position. No new sensor readings or anomaly events are fabricated.

Take Control pauses mission time. Keyboard movement retains collisions; Space/Stop stops movement. Manual movement leaves the displayed guide unchanged. A separate recovery path is computed only when Resume Mission is requested and is not rendered as white dots. Resume Mission traverses a new route from the **actual** manual position, holding source time until arrival, then continues the remaining timeline. Pause and Stop also work while rejoining. Return to Replay restores the paused recording. Seeking and switching missions clear manual branches.

The reference contains no stair/lift connection between floors. Cross-floor intervals hide the walking robot, omit an unsupported route, and display an explicit transfer explanation; it reappears at the next recorded floor visit. There is no claimed physical transition or invented shortcut. A manual resume across floors remains paused with an explanation until the operator returns to replay or seeks to the next floor. Continuous walking across floors is therefore not implemented.

## Geometry and rendering

Existing original Blender pump, turbine, vessel, transformer, and control-cabinet GLBs are reused. Two new original assets were built through the live Blender connection:

- `public/models/engineered/compressor.glb`: receiver skid, twin finned heads, motor, guards, gauges, relief/isolating hardware; 7,664 triangles, about 512 KiB.
- `public/models/engineered/heat_exchanger.glb`: shell-and-tube exchanger, bolted bonnets, saddles, cooling manifold, valves and gauges; 6,248 triangles, about 431 KiB.
- `art/spot-facility-expansion.blend`: separate saved review copy containing the expansion scene and the existing equipment library.
- `scripts/build-facility-equipment.py`: repeatable Blender generator using the existing library's material/export helpers; retains the original scene and restores it after export.

GLBs use metre-scale Z-up Blender geometry exported as Y-up glTF, uniform runtime fitting, embedded 128 px normal/metal/roughness maps, and six or seven material groups per new asset. All seven engineered assets total about 3.01 MiB. The provided CC BY industrial pipe/valve/panel libraries retain existing attribution. The unrelated exterior factory shell is neither downloaded nor placed in the reference facility. Original steel columns replace duplicate modular-kit columns around the registered wall endpoints.

The scene adds pipe banks, room-perimeter overhead services, cable trays, ducts, structural members, fixtures, foundations, fasteners, grating, maintenance railings/ladder, cooling-loop tanks, electrical bays and battery racks, warehouse shelving, and dock storage. Low cutaway walls reveal navigation and machinery. PBR materials, deterministic concrete maps, environment reflections, directional shadows, area-style lighting and contact AO are retained. Repeated details and navigation dots are instanced; AO disables itself after sustained slow frames. No actual inter-floor staircase is invented.

## Changed code

- `src/facility-layout.mjs`: shared image registration, floors, rooms, machinery and collision layout.
- `src/replay-engine.mjs`: grid routing, segment validation/smoothing, dot/path sampling, separate simulation/source clocks, recovery routing/state.
- `src/replay-environment.js`, `src/engineered-assets.mjs`: reference-based environment, GLB fitting/loading, per-floor visibility.
- `src/mission-markers.js`: clickable pins, zone/status styling and instanced navigation trail.
- `src/SpotReplayScene.jsx`: shared renderer, route/progress updates, floor-aware cameras, manual branch/rejoin behavior.
- `src/Facility3D.jsx`: Mapping uses the shared renderer and registration.
- `src/SpotMinimap.jsx`: source floor plan, registered robot/route and selectable pins.
- `src/MissionReplay.jsx`, `src/main.jsx`, `src/mission-replay.css`: run controls, synchronized floor/selection, waypoint evidence panel, transfer/rejoin status.
- `tests/facility-layout.test.mjs`, `tests/engineered-assets.test.mjs`: reference placement, all same-floor routes/dot interiors, timing/recovery, expanded asset validation.
- `scripts/check-facility.cjs`, `scripts/check-plant.cjs`: browser acceptance and existing regression checks.
- `README.md`, this document, and the Blender/assets listed above.

## Running and verification

Use **Node.js 22+** (Node 20 fails loading the existing Databricks dependency). From the project:

```sh
npm run dev
npm test
npm run build
```

Open `http://localhost:3000`. For Chrome browser acceptance using an existing Playwright installation:

```sh
SPOT_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-facility.cjs
SPOT_PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-plant.cjs
```

`SPOT_CHROME`, `SPOT_URL`, and `SPOT_CAPTURE_DIR` override browser, server and screenshots. The new suite captures both-floor, Floor 2, and dotted-route views. It checks all 11 model responses, shared Mapping rendering, floor persistence, all 15 sidebar pins, simulated walking, incremental resume from manual pose with source time paused, recorded evidence, console errors, and mobile overflow. Unit tests check all same-floor waypoint pairs including segment interiors, registration/floor/room assignments, model budgets, clocks and manual recovery.

## Limits

Dimensions, machinery pad placement, door clearance, ceiling heights and wall construction are estimates. The image supports room arrangement and pin registration but cannot establish exact internal circulation or hidden doorways. Continuous robot telemetry, surveyed building geometry, a cross-floor connection, physical robot control, and hardware-GPU frame-rate measurements are unavailable. The original raster image remains visible in the minimap for direct comparison. Headless software-WebGL checks establish functionality, not a device-specific performance guarantee. Vite still reports the existing large-bundle warning; the build succeeds.

## Verification results

Validated during implementation with Node.js 22: all **26 tests passed** and the production build succeeded. Chrome acceptance passed model loading (11 runtime GLBs), both shared 3D views, floor persistence, all 15 waypoints, simulated movement, manual rejoining with the source clock paused, recorded anomaly readings and mobile overflow checks with no page errors. A separate projected-coordinate click verified actual 3D marker picking and preserved selection in Mission Replay. The existing plant regression also verified the four cameras, manual movement/stop/return/resume, mission switches and evidence displays. Final layout tests include the additional cooling tanks and unfinished-inspection resume case. Browser captures are available in `/tmp/spotlight-facility/`; they precede the final cooling-tank/battery-rack detail additions.
