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
- Replay sorted by source timestamp, then event ID. Playback advances events at a chosen rate, not elapsed real time. The 500-event stream may cover only part of a mission; no missing events are fabricated.
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

