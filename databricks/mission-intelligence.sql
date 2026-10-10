-- Run in SQL Editor using workspace.spotlight, or npm run databricks:setup.
CREATE OR REPLACE VIEW workspace.spotlight.mission_health AS
WITH action_counts AS (
 SELECT mission_id, COUNT(*) total_actions, COUNT_IF(status='FAILED') failed_actions,
 COUNT_IF(status='SUCCESS') successful_actions FROM workspace.spotlight.actions GROUP BY mission_id
), anomaly_counts AS (
 SELECT mission_id, COUNT(*) anomaly_count, COUNT_IF(severity='CRITICAL') critical_anomalies,
 COUNT_IF(operator_review_required) review_anomalies FROM workspace.spotlight.anomalies GROUP BY mission_id
)
SELECT m.*, COALESCE(a.total_actions,0) total_actions, COALESCE(a.failed_actions,0) failed_actions,
 COALESCE(a.successful_actions,0) successful_actions, COALESCE(n.anomaly_count,0) anomaly_count,
 COALESCE(n.critical_anomalies,0) critical_anomalies,
 (m.mission_status='COMPLETED' AND COALESCE(a.failed_actions,0)>0) hidden_failure,
 (COALESCE(a.failed_actions,0)>0 OR COALESCE(n.review_anomalies,0)>0 OR COALESCE(n.critical_anomalies,0)>0) review_required
FROM workspace.spotlight.missions m LEFT JOIN action_counts a USING(mission_id) LEFT JOIN anomaly_counts n USING(mission_id);

CREATE OR REPLACE VIEW workspace.spotlight.waypoint_risk AS
SELECT l.location_id, l.location_name, l.floor, l.x_coord, l.y_coord,
 COUNT(a.action_id) total, COUNT_IF(a.status='FAILED') failed,
 ROUND(100.0*COUNT_IF(a.status='FAILED')/NULLIF(COUNT(a.action_id),0),1) failure_rate
FROM workspace.spotlight.locations l LEFT JOIN workspace.spotlight.actions a USING(location_id)
GROUP BY l.location_id,l.location_name,l.floor,l.x_coord,l.y_coord;

CREATE OR REPLACE VIEW workspace.spotlight.anomaly_priority AS
SELECT n.*, l.location_name, s.asset_name, s.criticality,
 CASE n.severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END severity_rank
FROM workspace.spotlight.anomalies n LEFT JOIN workspace.spotlight.locations l USING(location_id)
LEFT JOIN workspace.spotlight.assets s ON n.asset_id=s.asset_id;

CREATE OR REPLACE VIEW workspace.spotlight.configuration_reliability AS
SELECT configuration_version, action_type, GROUPING(action_type)=1 configuration_total,
 COUNT(*) total_actions, COUNT_IF(status='SUCCESS') successful_actions,
 ROUND(100.0*COUNT_IF(status='SUCCESS')/COUNT(*),1) success_rate
FROM workspace.spotlight.actions
GROUP BY GROUPING SETS ((configuration_version),(configuration_version,action_type));
