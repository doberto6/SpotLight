# SPOTlight

A local, runnable operations console built from the supplied synthetic Knight Hacks SPOT challenge kit. React + Vite frontend, Node HTTP backend. No hardware connection or ML predictions.

## Risk heatmap, sensor history, and mission reports

The Intelligence tab includes an interactive failure-rate heatmap with floor and configuration filters. Selecting a waypoint loads SQL summaries of failed inspections, affected assets, and mission visits. A mission opens its report; an asset opens its sensor history. Green is below 15% failed actions, yellow is 15–29.9%, red is at least 30%, and gray means no inspections. These rates measure inspection reliability, separately from anomaly severity.

Run `npm run databricks:setup` after updating the code. It creates the four mission intelligence views plus `workspace.spotlight.sensor_history`. Alternatively execute `databricks/sensor-trends.sql` in Databricks SQL Editor. The backend reads credentials from `.env`; SQL setup needs permission to create views. Intelligence and Reports run real SQL and can wake a stopped warehouse; System Health stays passive.

Sensor baselines use window functions partitioned by asset, measurement type, and unit, ordered by timestamp and reading ID. Each reading is compared only with the prior 10 observations, using GOOD values and requiring at least 3 GOOD samples. A GOOD reading outside two population standard deviations is flagged. For a zero-variance baseline, a change exceeding 10% of the baseline magnitude (with a tiny numerical tolerance for zero) is flagged. Two flagged readings in the latest 5 observations indicate recurrence. Non-GOOD readings are shown for quality review and do not contribute to baselines. These are exploratory historical comparisons, not calibrated safety thresholds or failure predictions. Sparse series explicitly show insufficient history; no warnings are fabricated.

New backend routes:
- `GET /api/databricks/risk?configuration=all|V1|V2`
- `GET /api/databricks/waypoint?location=WP09&configuration=all`
- `GET /api/databricks/sensor-trends`
- `GET /api/databricks/mission-report?mission=M006`

Reports are printable mission records sourced from Databricks: outcome, findings, failed actions, historical waypoint context, sensor changes/quality flags, and a browser-local follow-up checklist. A database failure displays a report error; local mock results are never substituted. Dates from the challenge retain their recorded values. Report generation time is UTC.

The Mapping 3D view shows a small image card only after SPOT reaches an inspection endpoint; a toggle hides it. The six photos in `04_ASSETS/sample_inspection_images` are synthetic examples without action-ID links. Matching is illustrative by inspection type (with pipe-gallery and valve examples at matching waypoints), and the UI identifies the photos as samples rather than mission captures. Mission Replay movement and controls remain intact.

Validation: `npm test` covers existing replay/navigation, SQL filter validation, provided photo assets, and passive health checks. `node --env-file=.env scripts/verify-intelligence.mjs` verifies live SQL heatmap counts, all preceding-sample baselines and warning flags, waypoint evidence, and report joins. This live check executes SQL and may start the warehouse.

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

Open **Mapping** and choose **3D**, or open **Mission Replay**. The 3D view uses the same image-registered facility geometry and clickable waypoint markers as Mission Replay. Drag to rotate, scroll to zoom, choose a floor, or use Reset view. The Mission Replay sidebar provides keyboard-accessible access to every location. The active replay waypoint is highlighted in both views.

The 3D geometry is a reference-based reconstruction with estimated dimensions. The challenge kit provides an image and waypoint metadata, but no measured building mesh, wall heights, or robot pose. Block placement is registered to the labels in the supplied floor-plan image and must not be interpreted as an accurate facility model or robot path.

### Interactive Spot mission simulator

Mission Replay reuses `createSpot` from the Mapping 3D page. It includes chase, free, top-down, and robot-perspective cameras, a default 75-second demo and elapsed-time playback at 1×, 2×, 4×, or 8×, timeline scrubbing, ±10-second seeking, event jumps, and selectable anomaly markers with recorded sensor readings. The elapsed-time simulator works independently of the Mapping date filter.

Take Control pauses recorded time and starts a simulated branch. Focus the viewport, then use W/S or up/down arrows to move, A/D or left/right arrows to turn, and Space to stop. Stop clears movement; Return to Replay discards the branch and restores the paused recorded position; Resume Mission follows a collision-safe route from the actual manual position to the next unfinished inspection while source time stays paused, then continues playback. Changing missions resets the simulator. Keyboard control only applies while the viewport has focus.

The plant boundaries, room arrangement, and waypoint pins are registered to the supplied floor plan. Door clearances and equipment dimensions are estimated. Positions interpolate between timestamped waypoint visits and pause for recorded inspection durations. Routes avoid the illustrative obstacles; the dataset does not include continuous poses or surveyed paths. The first waypoint supplies the initial pose because the mission-start event contains no position. Replay timestamps retain the source clock; displayed X/Z values use schematic scene units, not surveyed coordinates. Historical readings and battery values remain labeled as recorded during manual control.

Automated simulation uses the recorded route and can also be taken over manually. All operating modes are simulation-only. No physical robot commands or connections are implemented. A future real-robot integration belongs in an authenticated backend with operator authorization, state verification, explicit handoff, emergency stop, and SDK safety controls. `replay-engine.mjs` separates replay state, routing, and collision handling from the renderer; `SpotReplayScene.jsx` reuses the robot model and manages cameras and keyboard input.

`npm test` covers replay/manual transitions, time bounds and speed, recorded visit positions across all missions, inspection stops, and collision/routing behavior.

### Detailed industrial environment

Mission Replay now has concrete slabs, marked pedestrian corridors, glazed partitions, turbine/generator skids, boiler pressure vessels, pump/motor assemblies, switchgear, transformer fins and insulators, overhead piping with flanges and valves, cable trays, ducts, maintenance platforms and access rails, structural steel, waypoint markers, and overhead fixtures. These additions reuse the existing collision footprints so recorded visit positions, mission timing, anomaly markers, and manual navigation remain compatible. The layout is illustrative, not a surveyed power plant.

The five user-provided GLBs are curated into `public/models/industrial/` rather than loading their full source scenes. Structural columns now use unified original steel geometry to avoid duplicate overlapping meshes; `industrial_electrical_box` supplies cabinet assemblies; `industrial_pipes_pack` supplies pipe lengths, junctions, and handwheels; `large_modular_pipes_metal` supplies elbows, flanges, clamps, valves, and connectors. The merged `industrial_factory_with_towers_and_pipes` source contains roughly 580,000 triangles; its 9,107-triangle structural shell is preserved in the prepared library but excluded from the reference-registered facility, which defines no exterior generation yard.

Run `python3 scripts/prepare-industrial-assets.py --source-dir /path/to/source/models` on macOS to regenerate the prepared assets. This reads source files without modifying them, extracts selected meshes and their materials, repacks only the referenced vertex/index data, and downsamples textures to 768 pixels with `sips`. The prepared library is about 13 MB instead of nearly 400 MB. `manifest.json` records original sizes, extracted components, triangle counts, modifications, and embedded source metadata. Original scene transforms are retained for the electrical assembly and exterior shell; modular components are centered and fitted to their target equipment bays.

All five sources carry CC BY 4.0 attribution in their embedded metadata; those credits and source links appear in the simulator's Industrial model credits disclosure and in `src/industrial-credits.mjs`. Geometry extraction, texture resizing, and scene placement are the modifications. See each source entry in `public/models/industrial/manifest.json` for its author and license information.

The renderer uses PBR materials, environment reflections, ACES tone mapping, soft directional shadows, emissive indicators, and inexpensive contact shading. Procedural details and repeated imported components use GPU instancing, shared geometry/materials, and frustum culling. The reference-registered facility omits the unrelated exterior shell. Detailed models load asynchronously while the navigable procedural environment is already available; a missing asset leaves its procedural equipment in place. Resource disposal covers imported textures/materials, GPU instances, late asynchronous loads, and the reflection target. Tests validate prepared GLB buffer ranges, asset attribution, and the download/polygon budget alongside existing replay and collision tests.

## Blender equipment and rendering upgrade

Blender MCP was used to inspect all five provided GLBs and build a separate, original equipment library in `public/models/engineered/`. The new models are a dual pump/motor skid, split-casing turbine assembly, dished-head pressure vessel, oil-cooled transformer, and paired control cabinets. They include flange fasteners, cooling fins, couplings and guards, gauges, valve wheels, ceramic bushings, radiator headers, vents, and lifting/access details. The five GLBs total about 2.1 MB and 31,684 triangles across 27 material-group meshes; each type is instanced at its equipment bays. The supplied electrical enclosure remains as a smaller front-mounted assembly, and all five supplied asset libraries remain in use with their existing credits.

The editable `art/spot-engineered-assets.blend` contains the equipment scene, the source-model inspection scene, and the retained original scene. `scripts/build-blender-equipment.py` reproduces the GLBs when run inside Blender. It exports only selected objects in the active equipment scene, combines parts by material, and lays out the resulting assets for inspection. Set `SPOT_BUILD_NAMES` in its execution namespace to rebuild a subset. It only replaces its own named asset collections. Existing source models are not modified.

The exported materials include embedded 128-pixel metallic/roughness and tangent-space normal textures for enamel, cast iron, machined metal, rubber, and ceramic. Procedural concrete uses separate color, roughness, and normal textures. Interior views gain ceiling undersides, lighting highlights from four area lights, clearer directional shadows, and restrained GTAO at reduced resolution before ACES tone mapping and sRGB output. The optional AO pass disables itself after sustained slow frames. Roof decking has explicit Full, Hidden, Cutaway, and Overhead visibility controls. There is no bloom or baked lightmap dependency.

The shared robot now has rounded panels, sensor lenses, a payload sensor, vents, joint housings, knee articulation, and rubber feet. A two-link leg solver keeps the feet on the ground during stance and lifts them during swing. Diagonal leg pairs trot according to actual replay movement, manual speed, and direction; knees and feet settle when movement stops. Robot root motion, route data, sensor readings, timestamps, minimap, anomalies, and control transitions use the existing logic. Each imported machine is fitted uniformly inside its original collision envelope, and procedural machinery remains available if a GLB fails to load.

`npm test` includes export isolation, embedded PBR maps, polygon/download budgets, collision-envelope fit, and leg forward-kinematics checks alongside mission/data tests. `npm run build` verifies the bundled renderer. `scripts/check-plant.cjs` uses a separately installed Playwright package and Chrome to verify fifteen GLB loads, all cameras, manual movement/stop/return/resume, anomaly readings, mission switches, and mobile layout. Run with `SPOT_PLAYWRIGHT_MODULE` pointing at an existing Playwright module if it is not installed in the project, and set `SPOT_CHROME` for a different Chrome executable. It writes screenshots to `/tmp/spotlight-upgrade` by default (`SPOT_CAPTURE_DIR` overrides that path). Headless smoke checks use software WebGL; they establish correctness, not a measured hardware-GPU frame-rate guarantee.

The environment remains schematic: additional visual detail does not add surveyed coordinates, real robot poses, or a measured facility mesh.

## Databricks: complete the real integration

Local calculations are explicitly labeled and do **not** satisfy the Databricks sponsor requirement. The server already implements the SQL Statement Execution REST API and renders its results in Intelligence when configured.

1. Create a Databricks SQL warehouse and a schema, e.g. `main.spotlight`.
2. Upload the six CSV files from `data/SPOT_KnightHacks_Challenge_Kit Part One/02_DATA` using Databricks' create-table flow; preserve their field names. Use `actions` as the table name. See `databricks/analytics.sql` for the query.
3. Copy `.env.example` to `.env`. Set `DATABRICKS_HOST` (https workspace URL), `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, catalog and schema. Restart the server.
4. Open Intelligence. The source badge must say Databricks SQL warehouse and show a statement ID. A failed configured query is shown as an error, with local charts explicitly identified as fallback.

Credentials stay server-side. `.env` is ignored. Do not share it or commit it. Copy `.env.example` to `.env` and set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_CATALOG`, and `DATABRICKS_SCHEMA`. For the supplied Free Edition tables, use `workspace` and `spotlight` for the catalog and schema. The warehouse HTTP path is derived as `/sql/1.0/warehouses/<DATABRICKS_WAREHOUSE_ID>`.

The backend uses the official `@databricks/sql` Node.js connector. It exposes these credential-protected server endpoints: `/api/databricks/health`, `/api/databricks/missions`, `/api/databricks/hidden-failures`, `/api/databricks/hotspots`, `/api/databricks/anomalies`, and `/api/databricks/reliability`. The Intelligence page loads these endpoints and reports connector loading or query errors clearly. SQL operations, sessions, and clients are closed after every request. The React client never receives the token.

## Data and calculation notes

The supplied ZIPs were checked for path traversal before extraction. Included starter scripts were read, not executed. Original kit documents, assets and user-guide PDFs are preserved under `data/`.

Tables join on mission_id, action_id, location_id and asset_id. Loader validates mission/location and reading/anomaly action references. CSV values remain strings in source drawers; arithmetic explicitly converts values. Metrics use full source tables, not only the truncated replay stream.

- Completed with failures = distinct COMPLETED missions containing at least one FAILED action.
- Failure rate = FAILED actions / all actions in group; success rate = SUCCESS actions / all actions.
- Review required = operator_review_required equals True. Critical = severity equals CRITICAL.
- Replay sorted by source timestamp, then event ID. Mapping advances events at a chosen rate; the Mission Replay simulator advances elapsed source time and interpolates waypoint visits. The 500-event stream may cover only part of a mission; no missing events are fabricated.
- Source timestamps contain no timezone. UI preserves those strings without timezone conversion.
- Supplied floor-plan artwork has labeled waypoint positions that do not match the CSV x/y coordinates. `waypointPositions` in `src/facility-layout.mjs` registers each *existing* marker to its position in the source image (percentage of image width/height). Location labels and floors come from CSV metadata. Cyan segments connect action waypoints schematically; they are not navigable robot trajectories. Floor selector filters overlays while retaining the original two-floor artwork.
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

# Mission Intelligence and System Health

After configuring the backend `.env`, run `npm run databricks:setup` to create four SQL views using the existing six tables. The token needs SELECT on the raw tables and permission to create views in the configured schema. Alternatively execute `databricks/mission-intelligence.sql` in Databricks SQL Editor with your warehouse selected. The script uses `workspace.spotlight`; the setup command substitutes your configured catalog and schema. Re-running setup replaces these four analytics views.

The Intelligence tab queries `/api/databricks/overview` for mission review indicators, hidden failures (completed missions with failed actions), historical waypoint failure rates, severity-prioritized anomalies, and configuration/action-type success rates. Clicking a mission, waypoint, or finding loads `/api/databricks/evidence?kind=mission|waypoint|action&id=...` from Databricks, including actions, anomalies, and sensor readings. SQL aggregates actions and anomalies separately to avoid duplicated mission counts. Heatmap thresholds are display bands: green below 15%, amber 15–29.9%, red at least 30%, and gray without observations. These are historical inspection failure rates, not predictions of equipment failure.

System Health independently checks `/api/health` (backend uptime) and `/api/databricks/health` (read-only warehouse metadata via GET /api/2.0/sql/warehouses/{id}). Opening the tab and clicking Run checks never opens a SQL session or submits a query; a stopped warehouse stays stopped. The health endpoint reports API reachability and warehouse state, not SQL connectivity or analytics-view validity. Opening Intelligence still runs live SQL and can auto-start the warehouse. Click Run checks to repeat the passive checks. Credentials remain on the backend. Intelligence has explicit loading, empty, and failure states and never substitutes local records for unavailable SQL results. Existing mission replay and reports continue using the supplied challenge dataset.

For production: run `npm run build`, then `npm start`. Rebuild after frontend changes. Open `http://localhost:3000`.

## Reference-registered facility and dotted navigation

Mapping uses the original supplied floor-plan image on two raised, orbitable slabs, with waypoint overlays, schematic routes, Follow SPOT and sample imagery. Mission Replay uses the reconstructed industrial environment. Both retain the same waypoint image registration. See [the implementation and acceptance notes](docs/facility-simulation.md) for the simulator’s route behavior, assets, checks, and limitations.

Open **Mission Replay** and press **Play** for the default **75-second demo**. Inspection and finding order is retained, while travel and idle intervals are shortened. Original source timestamps are unchanged. Recorded timing and a 1.8 m/s estimated walking simulation remain selectable. White dots are fixed for the selected mission: replay progress, scrubbing, speed, camera, floor selection and manual movement never rebuild their buffers. **Show Mission Path** changes visibility only. The separate manual rejoin is computed once when Resume Mission is pressed and never replaces the displayed route. See [the rendering, static-route and demo report](docs/static-demo-upgrade.md) for causes, assets, screenshots, measured performance and checks. Select a floor and camera, click a waypoint pin or its sidebar button for available recorded inspection evidence, or take simulated manual control with WASD/arrows. Resume Mission rejoins from the manual position; Return to Replay discards that branch. Cross-floor connections are absent from the supplied reference and are explicitly shown as unavailable walking transfers rather than an invented passage.

The [industrial reference pass](docs/industrial-reference-pass.md) aligns ceiling framing and service supports, adds clerestory windows, and integrates an original Blender pipe manifold. The latest [geometry and collision improvements](docs/spot-collision-and-geometry.md) replace solid pipe supports with open Blender racks, correct mounting and shelf heights, add licensed PBR concrete and purposeful auxiliary equipment, and calibrate SPOT's rotating collision footprint. **Show SPOT Hitbox** is visible by default in Mission Replay. Mapping was subsequently restored to its image-based schematic view; [restored view](docs/screenshots/mapping-image-restored.png). The report includes matched screenshots, all-room inspection results, asset licenses, doorway tests and browser measurements.

## Spot Talk operator assistant

The machine learning forecast workflow is documented in [ml/README.md](ml/README.md).

Open **Spot Talk** using the Spot button at the bottom right. Ask about a mission (`M006`), waypoint (`WP09`), or asset (`HX-201`), or compare configurations. Choose a mission scope for focused questions. Explicit record identifiers override the scope selector; follow-up questions retain the last explicit scope. Changing scope or selecting New chat clears the conversation. Messages remain in browser memory only.

Spot Talk uses the existing Node backend and Databricks credentials. No separate OpenAI key or Python backend is required. The default Databricks chat endpoint is `databricks-meta-llama-3-3-70b-instruct`; optionally set `DATABRICKS_CHAT_ENDPOINT` in `.env` to another compatible chat endpoint. The credential must have SQL SELECT permission on the six raw tables and CAN QUERY access to the model endpoint. Restart the server after changing environment variables. Never put tokens in React or commit `.env`.

`POST /api/spot-talk` accepts `{ "question": "What went wrong in M006?", "mission": "all", "history": [] }`. It executes fixed, validated read-only SQL queries against missions, actions, readings, anomalies, assets, and locations, then sends the evidence and question to Databricks Model Serving. SQL calculates mission action counts, waypoint failure rates, and configuration/action-type rates; the model explains them. It never generates or executes SQL. Responses include the answer, cited source records, effective scope, model, and retrieval time. Click a citation to inspect the supporting SQL record; linked missions can open Reports. Evidence-backed waypoint IDs, location names, and asset IDs in an answer are also clickable: they open Mapping in 3D, select the supporting mission/date and floor, highlight the waypoint, and focus the camera. Aggregate answers open the latest recorded visit. The chat closes while retaining your conversation; reopen Spot Talk to continue.

Detail records are capped and sorted: 40 missions; 80 scoped actions or 40 latest facility failures; 60 scoped anomalies or 30 facility anomalies; 80 scoped readings or 25 facility readings; 40 assets; 45 waypoint aggregate groups; 40 configuration/action-type aggregate groups. Aggregate counts use all matching actions before limits are applied. The assistant is told about these limits and distinguishes action failures from physical equipment failures. This is synthetic challenge evidence, not a root-cause diagnosis or a validated predictive model. Operators should verify linked records. No mock answer replaces a failed connection.

Opening the panel does not query Databricks. Sending a question runs SQL and may start a stopped warehouse, and model inference consumes the workspace's available usage quota. Backend System Health remains a passive check. The API limits question/body/history sizes and concurrent questions, rejects cross-origin browser requests, and returns explicit errors for unavailable SQL/model connections. Model calls time out after 60 seconds; the UI allows 120 seconds including SQL retrieval, and offers Retry. The existing SQL connector closes operations, sessions, and clients in its finally blocks.

Validation: `npm test` includes request validation, SQL scope isolation, conversation scope handling, citation mapping, model failure behavior, and warehouse failure behavior. `npm run build` builds the chat panel. For a live check, send the example request above to your running local backend and inspect the returned source records.
