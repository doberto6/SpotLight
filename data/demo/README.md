# Offline demo data

Historical demo analytics are calculated from the six bundled CSV files in the challenge kit. They use the same failure-rate denominators, mission review rules, severity ordering and historical sensor-window rules as the Databricks views. The files are synthetic hackathon records, not real plant telemetry.

`ml-results.json` is a saved, previously trained experimental model result (`lr-20261010T233819-3050d141`). It retains all 133 candidates, original estimates, explanations, dates and holdout metrics. It is displayed as a **saved demo forecast snapshot**, never a freshly computed or live prediction. Updating the raw CSV files does not retrain this snapshot. To replace it, train and validate a model with `npm run ml:train`, then copy its credential-free `ml/artifacts/results.json` here and rerun the tests. Never copy tokens or `.env` into this directory.

Offline Spot Talk produces deterministic, cited record summaries. It does not call an AI model or consume inference tokens. It supports mission/waypoint/asset selections and configuration comparisons; it cannot answer arbitrary questions as a language model would.
