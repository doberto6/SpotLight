# Room details and wall finishes

The simulation now has a stronger industrial wall treatment throughout both floors, 30 room-specific service boards, and 17 substantial furnishings distributed across all 15 rooms. These additions build on the previous signs, safety fixtures, instruments, fans, bridge hoists and Blender workbench.

## Walls

The old lower wall mesh is replaced by dark skirting, painted lower panels, a metal dividing rail, warm concrete above, and a steel cap. Mechanical bays use blue-gray paint, electrical bays sage-gray, access/workshop areas muted green, and steam/storage areas warm gray. Shared 512-pixel PBR color, roughness and normal maps provide restrained paint grain and scuffs, with slight darkening at the lower edge. The existing concrete material remains above the paint.

Panel dividers, small fasteners, upper expansion joints and wall-mounted caged luminaires add structure. Segmentation follows the exposed faces of the existing wall union: no duplicate wall skins, interior intersection faces, or doorway closures. Architectural trim projects at most 8 mm, inside the existing 25 mm walking clearance. Upper fixtures follow roof/cutaway visibility; the lower wall treatment and service boards remain visible in cutaway mode.

## Room-specific additions

| Room | New floor furniture | New wall service assemblies |
| --- | --- | --- |
| WP01 Access | Three-door locker bank | PPE/emergency station and first aid cabinet |
| WP02 Switchgear | Operator console with two monitors/keyboards | Distribution/isolation board and cable-patching panel |
| WP03 Cooling water | Service cabinet | Cooling-water board and valve manifold |
| WP04 Process pumps | Maintenance cabinet | Valve manifold and motor starters |
| WP05 Steam services | Stocked component rack | Insulated steam-service board and valve manifold |
| WP06 Compressed air | Twin-column air dryer | Air filtration/regulation and motor starters |
| WP07 Service corridor | Safety cabinet | PPE/emergency station and communication panel |
| WP08 Turbine A | Lubrication service cabinet | Lubrication/filter services and motor starters |
| WP09 Generator B | Electrical cabinet | Lubrication/filter services and isolation board |
| WP10 Valve station | Service cabinet | Valve manifold and cooling-water services |
| WP11 UPS/batteries | Communication rack | DC fused distribution and cable patching |
| WP12 Heat exchange | Maintenance cabinet | Cooling-water and insulated steam-service boards |
| WP13 Spares | Additional stocked parts rack | Mechanical spares and labelled component bins |
| WP14 Transformer | Electrical cabinet | Distribution/isolation and motor control boards |
| WP15 Maintenance | Worktable, drawer cabinet and stocked parts rack | Hanging tool board and component shelves |

Service boards include mounting plates/fasteners and appropriate valves, gauges, filter bowls, switches, cable ports, shelves or tools. Full-height views reveal their supported ventilation enclosures, cable trunks and protective light fixtures. Existing warehouse crates receive straps, pull handles and labels on both aisle-facing sides. Existing maintenance carts receive additional cases seated on their actual tray surfaces beside the original cargo.

The console displays static wiring diagrams. Environmental gauge needles and switch colors are decorative; the existing mission monitor and inspection sidebar remain the source of recorded mission/readings data. No process values, inspection results or plant control functions are invented.

## Placement and navigation

Furniture sits against existing room walls, with working faces directed toward the aisle. Its complete physical mesh, including handles, fits inside its registered collision rectangle. All bodies rest on the floor; the shelf/case placement was checked against the original Blender tray geometry. Low markings are floor paint, not raised barriers.

Furniture positions were screened against every same-floor waypoint route, maintaining a conservative 0.83 m route clearance. The recorded path arrays were captured before introducing furniture and compared afterward: **all recorded mission paths remained identical**. Before/after verification and path hashes are retained in [placement results](browser-room-dressing-placement-results.json). Doorways, existing machines and waypoint pins retain their positions. New floor furniture is included in the shared manual/autonomous collision list; wall boards remain entirely above SPOT's 0.73 m walking envelope and are placed clear of machinery and cabinets.

The image-based Mapping view, minimap aspect ratio, default collapsed View options, white motion guide, calibrated hitbox, 1.8 m/s simulation speed and 75-second demo behavior are preserved.

## Rendering and assets

Repeated furniture and service components reuse shared geometry/material instance batches. Paint maps are shared across colors. One small 2048 × 128 label atlas is merged into two meshes, one per floor. Wall bands are grouped by material. Tiny trim fasteners use simple geometry; the visual review removed excessive sphere tessellation and unnecessary seam subdivisions.

The already prepared GLBs, manifests, workbench/cart Blender sources, and the Walchensee/Manapouri architectural photographs were inspected. Existing large machines and licensed models are reused; this pass downloads no marketplace assets and adds no GLB payload. Modular furnishings and wall-mounted parts were more efficiently built with the existing Three.js helpers. All 19 existing GLBs still load. Existing photo, texture and model attribution remains in [references/README.md](../references/README.md) and the asset manifests.

## Validation and visual review

- All **51 Node 22 tests** pass. New checks cover exact exposed-wall segmentation, two safe service boards in every room, furniture separation from walls/machines, complete mesh containment within collision footprints, floor contact and manual stopping at each new collider. Existing tests cover every same-floor waypoint pair, all recorded missions, narrow doorways, the full SPOT gait and static guidance buffers.
- Production build passes. The existing large-bundle warning remains.
- All **15 rooms** were captured at their recorded arrivals in chase and overhead views and visually reviewed against previous captures. The review corrected equipment/service-board overlap, cart case support and excessive fastener geometry. Final focused checks cover the deeper safety/storage fittings and a manual approach to the workshop.
- Full M006 replay completed in **75.004 seconds**, with no sampled hitbox collision, page error or asset warning. Manual takeover, stopping, one-plan rejoin, roof/camera modes, fullscreen, hitbox toggles, mission selection and mobile layout pass. Route buffer identities remain stable throughout operator changes.
- The full-run browser measurement on Apple M3 Pro / Chrome / ANGLE Metal, at a 1450 × 1050 viewport, recorded **60.01 FPS**, **1.62 ms average CPU render submission**, **341 renderer calls** and **409,245 submitted triangles**. The previous room fitout measured 311 calls and 334,237 triangles at approximately 60 FPS. Measurements are scene/device-specific CPU and renderer counters, not a GPU timing guarantee. The existing adaptive ambient-occlusion pass remains available and can disable itself on slower frames.

Reports: [replay and rendering](browser-detailed-replay-results.json), [all-room arrivals](browser-detailed-rooms-results.json), [final safety/storage fitting checks](browser-detailed-fixture-clearance-results.json).

Screenshots: [access lockers and walls](screenshots/walls-room-WP01.png), [switchgear room](screenshots/walls-room-WP02.png), [pump services](screenshots/walls-room-WP04.png), [electrical rack](screenshots/walls-room-WP11.png), [transformer bay](screenshots/walls-room-WP14.png), [workshop overhead](screenshots/walls-room-WP15-plan.png), [workshop approach](screenshots/walls-workshop-detail.png), [full-height walls](screenshots/walls-roof-full.png). All 30 room captures are named `walls-room-WP01` through `WP15`, with `-plan` for overhead views. Previous `fitout-room-*` images provide the comparison.

Primary files: `src/wall-finishes.js`, `src/plant-surfaces.js`, `src/room-dressing.mjs`, `src/room-dressing.js`, `src/room-furniture.mjs`, `src/room-furniture.js`, `src/facility-layout.mjs`, `src/replay-environment.js` and `tests/room-dressing.test.mjs`.

Reproduce with Node 22 `--test`, `npm run build`, and the existing `scripts/inspect-industrial-rooms.cjs` / `scripts/check-static-demo.cjs` browser scripts. Use `SPOT_ROOM_PHASE=walls` and `SPOT_ROOM_RESULTS_FILE=docs/browser-detailed-rooms-results.json` for room captures; use `SPOT_PHASE=walls` and `SPOT_RESULTS_FILE=docs/browser-detailed-replay-results.json` for replay capture. Set `SPOT_PLAYWRIGHT_MODULE` to the local Playwright installation if it is external to this repository.
