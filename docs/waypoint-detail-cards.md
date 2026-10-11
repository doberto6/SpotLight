# Simulation waypoint details

Click a WP label or its floor ring to open an information card directly inside the simulation. The minimap and waypoint sidebar buttons open the same card. It remains available in fullscreen; close it with × or Escape. The close button stays visible while scrolling. Pointer hover identifies selectable markers, and dragging the camera does not trigger a selection.

The card shows the source waypoint name, floor, zone and environment tag, a description of the simulated room, room precautions from the existing signage, and source equipment IDs/names. General room precautions are labelled **Simulated room signage**, separate from mission evidence.

**Recorded concerns** shows encountered anomalies with severity, descriptions, asset IDs, timestamps and operator-review flags. Failed actions appear as inspection concerns only after their recorded duration finishes. Later findings are placed in a separate collapsed **Later in this recording** section. Latest visit/readings are also expandable, with readings filtered to their source timestamps. Missing evidence is described as unvisited or no anomalies recorded for this mission, rather than an all-clear assessment.

Selecting a waypoint preserves the replay time, manual branch, SPOT pose, calibrated hitbox and static route buffers. Explicit **View recorded finding**, **Jump to recorded finding** and **View recorded action** buttons seek to that evidence. Changing the visible floor hides a card for the other floor. On narrow screens, the card temporarily makes room by hiding the minimap/hint and camera/takeover controls; fullscreen remains accessible and closing the card restores the controls.

Implementation: `src/waypoint-details.mjs` builds time-scoped evidence; `src/WaypointDetails.jsx` renders the card; `src/MissionReplay.jsx` handles selection; `src/mission-markers.js` makes labels/rings selectable; `src/SpotReplayScene.jsx` handles pointer priority and hover; `src/mission-replay.css` positions the responsive card. WP labels receive click priority over other overlays. Existing equipment inspection markers still work.

Validation: **55 Node 22 tests pass**, production build passes with the existing large-bundle warning, and the actual browser click check covers unchanged pose/time/route/hitbox, manual mode, fullscreen, source findings, rewinding, floor filtering, dismissal and mobile bounds. The existing equipment inspection check also passes with no browser errors.

Results: [waypoint interaction](browser-waypoint-details-results.json) and [equipment inspection regression](browser-inspection-assets-results.json). Screenshots: [recorded critical concern](screenshots/waypoint-details-desktop.png) and [mobile card](screenshots/waypoint-details-mobile.png). Reproduce with `scripts/check-waypoint-details.cjs` and `scripts/check-inspection-assets.cjs`, using Node 22 and `SPOT_PLAYWRIGHT_MODULE` when Playwright is installed outside the repository.
