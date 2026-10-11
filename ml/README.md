# Next Inspection Risk Forecast

Open **Intelligence → Predictive Intelligence**. All displayed estimates and model metrics come from Databricks, through the existing Node backend. Select a candidate or a floorplan marker for the model explanation, actual historical failed-action records, reports, or the 3D map. The map switches between dashed predicted-risk markers and solid historical-rate markers. Each predicted waypoint marker represents its highest-risk candidate, not the average risk of everything at that waypoint.

This is an **experimental model of inspection action failure**, not a prediction of physical equipment failure or an explanation of its cause. The source is synthetic hackathon data. Current validation caught none of six held-out failures at the predefined 30% review threshold. ROC-AUC was 0.491. The dashboard prominently shows this limitation; lower risk cannot be used to rule out failure.

## Run setup and training

The existing `.env` supplies `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_CATALOG`, and `DATABRICKS_SCHEMA`. The token needs SELECT on the four source tables, warehouse access, and permission to create views/tables and INSERT in the configured schema. The six raw tables are never modified. The Python subprocess receives file paths; it does not connect to Databricks or run a separate server.

Create an isolated Python 3.12 environment once:

```powershell
python -m venv ml/.venv
ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.txt
npm run ml:inspect
npm run ml:train
npm run ml:test
```

On macOS/Linux use `python3 -m venv ml/.venv` and `ml/.venv/bin/python -m pip install -r ml/requirements.txt`. An optional `SPOTLIGHT_PYTHON` environment variable can select another Python executable. The included requirements pin the main libraries. Train/retrain with `npm run ml:train` after uploading updated raw data. Refresh forecasts in the dashboard afterward. Training is an explicit CLI operation; reading the dashboard never retrains a model. SQL reads may start a stopped warehouse, while the existing System Health check stays passive.

The first run on this computer executed with local Python/scikit-learn. Databricks Free Edition supports serverless notebooks and jobs with quotas ([official limitations](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)). We use the existing verified SQL connector and local training so no new notebook, job, model endpoint, or MLflow service is required. This is a batch forecasting workflow, with governed SQL preparation and Delta persistence. MLflow is not configured.

## Data and leakage controls

The runner inspects actual schemas, applies `databricks/ml_features.sql` and `databricks/ml_predictions.sql`, extracts the feature rows through `@databricks/sql`, trains/evaluates with scikit-learn, then publishes results back through the same connector. Connections, sessions, and operations use the existing close-in-finally implementation.

Training labels are FAILED=1 and SUCCESS=0. Other statuses, null/invalid times, negative/null duration, and invalid mission intervals are excluded. A forecast candidate repeats a previously observed location/asset/action combination under the latest recorded robot configuration and the combination's last observed hour. There is no future mission plan. The forecast is **after the dataset cutoff**, not necessarily a prediction of a scheduled inspection today. Dates are source wall-clock timestamps; the data does not establish the plant's timezone.

History is computed at **mission start**. An older action contributes only if its duration has elapsed AND its mission has ended strictly before that cutoff; actions in the current mission are excluded. Equal-time and overlapping mission outcomes are excluded rather than ordered into history artificially. Stable ordering of mission ID, sequence, and action ID resolves candidate-selection ties. Duration and mission end are only availability gates for earlier outcomes; they are never predictors of the target action. Current readings, anomalies, battery-after-action, failure type, mission status, and target outcomes are not input features. An independent Python audit recomputes every historical count/rate from the Databricks eligible-action rows before fitting.

Categorical inputs: waypoint, asset ID, asset type, action type, configuration, and environment. Numeric inputs: assumed inspection hour; prior waypoint count/rate; prior asset count/rate; prior action-type count/rate; prior configuration failure rate. Location and asset attributes are assumed static; the raw tables do not provide historical attribute versions. Numeric preprocessing and categorical encoding are fitted only on training missions for evaluation. Unknown categories are ignored. Zero-history rates are zero with separate history counts to identify those cases.

The model is regularized logistic regression (L2, C=0.25), without synthetic resampling or class weights that inflate risk probabilities. It is compared with a constant historical-rate baseline fitted on training labels. The last 20% of missions form the holdout; no mission is split. Earlier completed holdout outcomes may update historical inputs to later holdout missions, as they would operationally; the evaluation model is not refitted. Forecast generation refits the fixed pipeline on all eligible actions. No tuning uses holdout labels.

## Actual initial validation

| Measure | Logistic regression | Historical-rate baseline |
|---|---:|---:|
| Training actions / missions | 210 / 21 | 210 / 21 |
| Test actions / missions | 60 / 6 | 60 / 6 |
| Test failures | 6 (10%) | 6 (10%) |
| Precision at 30% | 0% | 0% |
| Recall at 30% | 0% | 0% |
| ROC-AUC | 0.490741 | 0.500000 |
| PR-AUC (average precision) | 0.107777 | 0.100000 |
| Brier score | 0.095263 | 0.100975 |
| Confusion matrix (TN, FP; FN, TP) | 53, 1; 6, 0 | 54, 0; 6, 0 |

Final forecast model: 270 eligible actions, 49 failed / 221 successful; 133 known inspection candidates. Four have scores ≥30%, 27 are 15–29.9%, and 102 are below 15%. These are review bands, not anomaly severity. Current forecasts assume configuration V2. Training all data and reporting training accuracy would be misleading, so the dashboard reports the earlier chronological holdout instead.

The highest initial estimates were WP05 acoustic inspection (~32.7%) and WP09 gauge reading (~32.3%). These estimates are uncalibrated experimental scores. The small held-out sample and poor failure detection prevent claiming reliable real-world probability or useful discrimination. More labeled missions, separate time periods, and calibration/validation on independent operational data are needed before operational use.

## Explanation and persistence

Explanations use actual logistic coefficients multiplied by encoded/standardized inputs, grouped by original feature. They are additive **log-odds** contributions relative to the model intercept. Summing all contributions and the intercept, then applying the logistic function, reconstructs the score. Positive and negative contributions are shown. They are associations, not causal explanations or percentage-point changes. Historical failed-action records show what the data actually reported.

Outputs are appended atomically as a single Delta INSERT into `workspace.spotlight.ml_runs`; `ml_predictions` and `ml_model_metrics` are readable SQL views over that table, with typed summary columns and full JSON payloads. One Delta commit publishes all forecasts plus metrics, preventing partial model releases. The backend selects one latest model version per overview request. Source content fingerprints detect updates to actions/missions/locations/assets and flag stale forecasts. The UI also displays the source cutoff and age. This is not a live telemetry forecast.

Artifacts in ignored `ml/artifacts/`: schemas, features and audited eligible history, model.joblib, results.json. Never load an untrusted joblib file. There are no credentials in the artifacts. `node scripts/ml-run.mjs --no-publish` trains without publishing; `--publish-existing` publishes the local results only if the source fingerprint still matches. A repeated publication of the same model version is skipped.

## Verify from Databricks

Run the SQL scripts in order in the SQL Editor, replacing `workspace.spotlight` if configured differently. The training command applies them automatically. Inspect:

```sql
SELECT target_kind, COUNT(*) FROM workspace.spotlight.ml_action_features GROUP BY target_kind;
SELECT model_version, training_count, test_count, roc_auc, recall, brier_score
FROM workspace.spotlight.ml_model_metrics ORDER BY published_at DESC;
SELECT location_id, asset_id, action_type, predicted_failure_probability,
       historical_failure_rate, historical_sample_size, risk_category
FROM workspace.spotlight.ml_predictions
WHERE model_version = (
  SELECT model_version FROM workspace.spotlight.ml_model_metrics
  ORDER BY published_at DESC, model_version DESC LIMIT 1
)
ORDER BY predicted_failure_probability DESC;
```

The dashboard's `/api/ml/overview` returns exactly the stored model metrics and forecast payloads. Inspect the network response and compare its model version/estimates with the SQL results. API endpoints: `GET /api/ml/status`, `/api/ml/predictions`, `/api/ml/predictions/WP09`, `/api/ml/metrics`, and `/api/ml/overview`. Missing model tables show a setup/empty state. Connection or query failures return a clear HTTP 502 error; no CSV, random, or mock prediction fallback exists.

Tests: `npm test` for existing app/ML API validation, and `npm run ml:test` for chronological splitting, strict historical timing, probability validation, and exact contribution reconstruction. Real training separately audits SQL feature rows against Databricks history.
