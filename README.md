# SPOTlight

A local, runnable operations console built from the supplied synthetic Knight Hacks SPOT challenge kit. React + Vite frontend, Node HTTP backend. No hardware connection or ML predictions.

## Start

Requires Node.js 22+ and npm. From this folder:

```powershell
npm install
npm run dev
```

Open http://localhost:3000. `npm test` verifies source joins, status logic, metrics, CSV parsing and replay ordering. `npm run build` creates the production frontend; `npm start` serves that build. `npm run dev` always uses Vite with hot reload, even when a production build exists.

## Demo

1. Overview shows dataset-wide totals and distinguishes completed missions with failed actions.
2. Select M006, open a critical anomaly at WP09, and inspect the exact source record and associated reading.
3. Use Locate in mission replay, then play/pause, seek, and change playback speed.
4. Intelligence shows waypoint failure rates and V1/V2 action success. Click a waypoint bar for underlying inspections.
5. Reports shows selected-mission outcomes, anomaly readings and a browser-local review checklist. Print / Save PDF uses the browser print dialog.

### Facility map views

Open the **3D Map** page or use the **2D / 3D** switch in Overview or Mission Replay. The 3D view places simple room blocks and clickable waypoint labels over the supplied floor-plan artwork. Drag to rotate, scroll to zoom, choose a floor, or use Reset view. The waypoint strip below the scene provides keyboard-accessible access to every location. The active replay waypoint is highlighted in both views.

The 3D geometry is a schematic illustration. The challenge kit provides an image and waypoint metadata, but no measured building mesh, wall heights, or robot pose. Block placement is registered to the labels in the supplied floor-plan image and must not be interpreted as an accurate facility model or robot path.

### Interactive Spot mission simulator

Mission Replay reuses `createSpot` from the Mapping 3D page. It includes chase, free, top-down, and robot-perspective cameras, elapsed-time playback at 0.5×–4×, timeline scrubbing, ±10-second seeking, event jumps, and selectable anomaly markers with recorded sensor readings. The elapsed-time simulator works independently of the Mapping date filter.

Take Control pauses recorded time and starts a simulated branch. Focus the viewport, then use W/S or up/down arrows to move, A/D or left/right arrows to turn, and Space to stop. Stop clears movement; Return to Replay discards the branch and restores the paused recorded position; Resume Mission restores it and continues playback. Changing missions resets the simulator. Keyboard control only applies while the viewport has focus.

The plant partitions, doorway openings, machinery, and collision bounds are illustrative. Positions interpolate between timestamped waypoint visits and pause for recorded inspection durations. Routes avoid the illustrative obstacles; the dataset does not include continuous poses or surveyed paths. The first waypoint supplies the initial pose because the mission-start event contains no position. Replay timestamps retain the source clock; displayed X/Z values use schematic scene units, not surveyed coordinates. Historical readings and battery values remain labeled as recorded during manual control.

Automated simulation uses the recorded route and can also be taken over manually. Both operating modes are simulation-only. No physical robot commands or connections are implemented. A future real-robot integration belongs in an authenticated backend with operator authorization, state verification, explicit handoff, emergency stop, and SDK safety controls. `replay-engine.mjs` separates replay state, routing, and collision handling from the renderer; `SpotReplayScene.jsx` reuses the robot model and manages cameras and keyboard input.

`npm test` covers replay/manual transitions, time bounds and speed, recorded visit positions across all missions, inspection stops, and collision/routing behavior.

### Detailed industrial environment

Mission Replay now has concrete slabs, marked pedestrian corridors, glazed partitions, turbine/generator skids, boiler pressure vessels, pump/motor assemblies, switchgear, transformer fins and insulators, overhead piping with flanges and valves, cable trays, ducts, maintenance platforms and access rails, structural steel, equipment signs, and overhead fixtures. These additions reuse the existing collision footprints so recorded visit positions, mission timing, anomaly markers, and manual navigation remain compatible. The layout is illustrative, not a surveyed power plant.

The five user-provided GLBs are curated into `public/models/industrial/` rather than loading their full source scenes. `factory_modular_kit` supplies structural columns, beams, and access components; `industrial_electrical_box` supplies cabinet assemblies; `industrial_pipes_pack` supplies pipe lengths, junctions, and handwheels; `large_modular_pipes_metal` supplies elbows, flanges, clamps, valves, and connectors. The merged `industrial_factory_with_towers_and_pipes` source contains roughly 580,000 triangles; its 9,107-triangle structural shell is used deliberately as an exterior generation-yard backdrop with distance LOD.

Run `python3 scripts/prepare-industrial-assets.py --source-dir /path/to/source/models` on macOS to regenerate the prepared assets. This reads source files without modifying them, extracts selected meshes and their materials, repacks only the referenced vertex/index data, and downsamples textures to 768 pixels with `sips`. The prepared library is about 13 MB instead of nearly 400 MB. `manifest.json` records original sizes, extracted components, triangle counts, modifications, and embedded source metadata. Original scene transforms are retained for the electrical assembly and exterior shell; modular components are centered and fitted to their target equipment bays.

All five sources carry CC BY 4.0 attribution in their embedded metadata; those credits and source links appear in the simulator's Industrial model credits disclosure and in `src/industrial-credits.mjs`. Geometry extraction, texture resizing, and scene placement are the modifications. See each source entry in `public/models/industrial/manifest.json` for its author and license information.

The renderer uses PBR materials, environment reflections, ACES tone mapping, soft directional shadows, emissive indicators, and inexpensive contact shading. Procedural details and repeated imported components use GPU instancing, shared geometry/materials, and frustum culling. The exterior shell uses distance LOD. Detailed models load asynchronously while the navigable procedural environment is already available; a missing asset leaves its procedural equipment in place. Resource disposal covers imported textures/materials, GPU instances, late asynchronous loads, and the reflection target. Tests validate prepared GLB buffer ranges, asset attribution, and the download/polygon budget alongside existing replay and collision tests.

## Databricks: complete the real integration

Local calculations are explicitly labeled and do **not** satisfy the Databricks sponsor requirement. The server already implements the SQL Statement Execution REST API and renders its results in Intelligence when configured.

1. Create a Databricks SQL warehouse and a schema, e.g. `main.spotlight`.
2. Upload the six CSV files from `data/SPOT_KnightHacks_Challenge_Kit Part One/02_DATA` using Databricks' create-table flow; preserve their field names. Use `actions` as the table name. See `databricks/analytics.sql` for the query.
3. Copy `.env.example` to `.env`. Set `DATABRICKS_HOST` (https workspace URL), `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, catalog and schema. Restart the server.
4. Open Intelligence. The source badge must say Databricks SQL warehouse and show a statement ID. A failed configured query is shown as an error, with local charts explicitly identified as fallback.

Credentials stay server-side. `.env` is ignored. Do not share it. Missing inputs: workspace host, authorized token, warehouse ID, and uploaded actions table. A real query cannot be verified until these are supplied. The other dashboard metrics remain computed by the local backend; only the waypoint chart switches to Databricks.

## Data and calculation notes

The supplied ZIPs were checked for path traversal before extraction. Included starter scripts were read, not executed. Original kit documents, assets and user-guide PDFs are preserved under `data/`.

Tables join on mission_id, action_id, location_id and asset_id. Loader validates mission/location and reading/anomaly action references. CSV values remain strings in source drawers; arithmetic explicitly converts values. Metrics use full source tables, not only the truncated replay stream.

- Completed with failures = distinct COMPLETED missions containing at least one FAILED action.
- Failure rate = FAILED actions / all actions in group; success rate = SUCCESS actions / all actions.
- Review required = operator_review_required equals True. Critical = severity equals CRITICAL.
- Replay sorted by source timestamp, then event ID. Mapping advances events at a chosen rate; the Mission Replay simulator advances elapsed source time and interpolates waypoint visits. The 500-event stream may cover only part of a mission; no missing events are fabricated.
- Source timestamps contain no timezone. UI preserves those strings without timezone conversion.
- Supplied floor-plan artwork has labeled waypoint positions that do not match the CSV x/y coordinates. `positions` in `src/main.jsx` manually registers each *existing* marker to its position in the source image (percentage of image width/height). Location labels and floors come from CSV metadata. Cyan segments connect action waypoints schematically; they are not navigable robot trajectories. Floor selector filters overlays while retaining the original two-floor artwork.
- Sample inspection images have no record-level links and are not presented as evidence for particular anomalies.
- Configuration comparison is descriptive and does not establish causality.
- Checklist is saved in this browser, not shared between operators. No real plant control actions are implemented.

## Project layout

- `src/main.jsx`, `src/style.css`: dashboard and interactions.
- `data.mjs`: CSV loader, validation and analytics.
- `server.mjs`: local API, assets, Databricks integration, Vite/production serving.
- `tests/data.test.mjs`: meaningful data correctness tests.
- `databricks/analytics.sql`: warehouse query for sponsor setup.

Next team work: configure and verify Databricks, replace browser-local follow-up with a shared database, add authentication before exposing the server remotely, and extend ingestion to new mission files. The server binds to localhost for this MVP.

Databricks API reference: https://docs.databricks.com/api/statement-execution/v1/statement-execution

