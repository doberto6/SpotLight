-- A historical comparison for each asset / measurement / unit.
-- The current reading never contributes to its own baseline.
-- QUESTIONABLE readings are displayed but are excluded from baseline statistics.
CREATE OR REPLACE VIEW workspace.spotlight.sensor_history AS
WITH history AS (
 SELECT r.*, s.asset_name,
 COUNT(CASE WHEN quality='GOOD' THEN value END) OVER prior baseline_count,
 AVG(CASE WHEN quality='GOOD' THEN value END) OVER prior baseline_mean,
 STDDEV_POP(CASE WHEN quality='GOOD' THEN value END) OVER prior baseline_stddev,
 LAG(value) OVER (PARTITION BY r.asset_id,measurement_type,unit ORDER BY timestamp,reading_id) previous_value
 FROM workspace.spotlight.readings r LEFT JOIN workspace.spotlight.assets s ON r.asset_id=s.asset_id
 WINDOW prior AS (PARTITION BY r.asset_id,measurement_type,unit ORDER BY timestamp,reading_id ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING)
), evaluated AS (
 SELECT *, value-previous_value step_change,
 ROUND((value-baseline_mean)/NULLIF(baseline_stddev,0),2) deviation_sigma,
 CASE WHEN baseline_count>=3 AND quality='GOOD' AND value IS NOT NULL THEN
   CASE WHEN baseline_stddev>0 THEN ABS(value-baseline_mean)>2*baseline_stddev
        WHEN baseline_stddev=0 THEN ABS(value-baseline_mean)>GREATEST(ABS(baseline_mean)*0.1,0.000001)
        ELSE false END
   ELSE false END warning
 FROM history
), recurrence AS (
 SELECT *, COUNT_IF(warning) OVER (PARTITION BY asset_id,measurement_type,unit ORDER BY timestamp,reading_id ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) recent_warning_count
 FROM evaluated
)
SELECT *, CASE WHEN quality<>'GOOD' OR quality IS NULL THEN 'QUALITY_REVIEW'
 WHEN baseline_count<3 THEN 'INSUFFICIENT_HISTORY'
 WHEN warning AND recent_warning_count>=2 THEN 'RECURRING'
 WHEN warning THEN 'ISOLATED'
 ELSE 'WITHIN_BASELINE' END signal_status
FROM recurrence;
