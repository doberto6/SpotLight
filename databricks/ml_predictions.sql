-- Append runs; publish forecasts + metadata atomically in ONE Delta table.
CREATE TABLE IF NOT EXISTS workspace.spotlight.ml_runs (
 model_version STRING,record_kind STRING,target_id STRING,payload STRING,published_at TIMESTAMP
) USING DELTA;

CREATE OR REPLACE VIEW workspace.spotlight.ml_model_metrics AS
SELECT model_version,
 CAST(get_json_object(payload,'$.training_count') AS INT) training_count,
 CAST(get_json_object(payload,'$.test_count') AS INT) test_count,
 CAST(get_json_object(payload,'$.candidate_count') AS INT) candidate_count,
 CAST(get_json_object(payload,'$.evaluation.roc_auc') AS DOUBLE) roc_auc,
 CAST(get_json_object(payload,'$.evaluation.pr_auc') AS DOUBLE) pr_auc,
 CAST(get_json_object(payload,'$.evaluation.brier_score') AS DOUBLE) brier_score,
 CAST(get_json_object(payload,'$.evaluation.precision') AS DOUBLE) precision,
 CAST(get_json_object(payload,'$.evaluation.recall') AS DOUBLE) recall,
 get_json_object(payload,'$.trained_at') trained_at,payload,published_at
FROM workspace.spotlight.ml_runs
WHERE record_kind='metrics';

CREATE OR REPLACE VIEW workspace.spotlight.ml_predictions AS
SELECT model_version,target_id,
 get_json_object(payload,'$.location_id') location_id,
 get_json_object(payload,'$.asset_id') asset_id,
 get_json_object(payload,'$.action_type') action_type,
 get_json_object(payload,'$.configuration_version') configuration_version,
 CAST(get_json_object(payload,'$.predicted_failure_probability') AS DOUBLE) predicted_failure_probability,
 get_json_object(payload,'$.risk_category') risk_category,
 CAST(get_json_object(payload,'$.historical_failure_rate') AS DOUBLE) historical_failure_rate,
 CAST(get_json_object(payload,'$.historical_sample_size') AS INT) historical_sample_size,
 get_json_object(payload,'$.data_cutoff') data_cutoff,payload,published_at
FROM workspace.spotlight.ml_runs
WHERE record_kind='prediction';
