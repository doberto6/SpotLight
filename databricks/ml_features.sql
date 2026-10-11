-- Inspect schemas with scripts/ml-inspect.mjs before applying.
-- Duration/end_time are used ONLY to establish when older outcomes are available.
CREATE OR REPLACE VIEW workspace.spotlight.ml_eligible_actions AS
SELECT a.action_id,a.mission_id,a.location_id,COALESCE(a.asset_id,'NO_ASSET') asset_id,
 a.action_type,m.configuration_version,l.location_name,l.floor,l.environment,
 COALESCE(s.asset_name,'No asset') asset_name,COALESCE(s.asset_type,'NO_ASSET') asset_type,
 CAST(a.timestamp AS TIMESTAMP) action_at,CAST(m.start_time AS TIMESTAMP) mission_start,
 CAST(m.end_time AS TIMESTAMP) mission_end,
 TIMESTAMPADD(SECOND,CAST(a.duration_sec AS INT),CAST(a.timestamp AS TIMESTAMP)) outcome_at,
 CAST(a.sequence AS INT) sequence,HOUR(a.timestamp) inspection_hour,
 CASE WHEN a.status='FAILED' THEN 1 ELSE 0 END label
FROM workspace.spotlight.actions a
JOIN workspace.spotlight.missions m ON a.mission_id=m.mission_id
JOIN workspace.spotlight.locations l ON a.location_id=l.location_id
LEFT JOIN workspace.spotlight.assets s ON a.asset_id=s.asset_id
WHERE a.status IN ('FAILED','SUCCESS') AND a.timestamp IS NOT NULL
 AND m.start_time IS NOT NULL AND m.end_time IS NOT NULL
 AND a.duration_sec IS NOT NULL AND a.duration_sec>=0 AND a.timestamp>=m.start_time
 AND m.end_time>=m.start_time;

-- Candidates repeat previously seen location/asset/action combinations under the
-- latest observed configuration and each combination's latest observed hour.
CREATE OR REPLACE VIEW workspace.spotlight.ml_feature_targets AS
WITH latest_config AS (
 SELECT configuration_version FROM workspace.spotlight.missions
 WHERE start_time IS NOT NULL ORDER BY start_time DESC,mission_id DESC LIMIT 1
), watermark AS (
 SELECT GREATEST(MAX(outcome_at),MAX(mission_end))+INTERVAL 1 SECOND cutoff_at
 FROM workspace.spotlight.ml_eligible_actions
), candidates AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY location_id,asset_id,action_type
 ORDER BY action_at DESC,mission_id DESC,sequence DESC,action_id DESC) rn
 FROM workspace.spotlight.ml_eligible_actions
)
SELECT 'training' target_kind,action_id target_id,action_id,mission_id,location_id,asset_id,
 action_type,configuration_version,location_name,floor,environment,asset_name,asset_type,
 action_at,mission_start cutoff_at,inspection_hour,sequence,label
FROM workspace.spotlight.ml_eligible_actions
UNION ALL
SELECT 'forecast',CONCAT(c.location_id,'|',c.asset_id,'|',c.action_type),NULL,NULL,
 c.location_id,c.asset_id,c.action_type,lc.configuration_version,c.location_name,c.floor,
 c.environment,c.asset_name,c.asset_type,w.cutoff_at,w.cutoff_at,c.inspection_hour,c.sequence,
 CAST(NULL AS INT)
FROM candidates c CROSS JOIN latest_config lc CROSS JOIN watermark w WHERE c.rn=1;

CREATE OR REPLACE VIEW workspace.spotlight.ml_action_features AS
SELECT b.*,
 COUNT_IF(h.location_id=b.location_id) location_n,
 COUNT_IF(h.location_id=b.location_id AND h.label=1) location_failed,
 COALESCE(1.0*COUNT_IF(h.location_id=b.location_id AND h.label=1)/NULLIF(COUNT_IF(h.location_id=b.location_id),0),0.0) location_rate,
 COUNT_IF(h.asset_id=b.asset_id) asset_n,
 COUNT_IF(h.asset_id=b.asset_id AND h.label=1) asset_failed,
 COALESCE(1.0*COUNT_IF(h.asset_id=b.asset_id AND h.label=1)/NULLIF(COUNT_IF(h.asset_id=b.asset_id),0),0.0) asset_rate,
 COUNT_IF(h.action_type=b.action_type) type_n,
 COALESCE(1.0*COUNT_IF(h.action_type=b.action_type AND h.label=1)/NULLIF(COUNT_IF(h.action_type=b.action_type),0),0.0) type_rate,
 COALESCE(1.0*COUNT_IF(h.configuration_version=b.configuration_version AND h.label=1)/NULLIF(COUNT_IF(h.configuration_version=b.configuration_version),0),0.0) configuration_rate,
 MAX(h.outcome_at) history_last_outcome,MAX(h.mission_end) history_last_mission_end
FROM workspace.spotlight.ml_feature_targets b
LEFT JOIN workspace.spotlight.ml_eligible_actions h
 ON h.outcome_at<b.cutoff_at AND h.mission_end<b.cutoff_at
 AND (b.mission_id IS NULL OR h.mission_id<>b.mission_id)
GROUP BY ALL;
