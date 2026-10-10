import {query,table} from './databricks.mjs';
function id(value){if(!/^[-A-Za-z0-9_]{1,80}$/.test(value||''))throw Error('Invalid record identifier');return value;}
export function configurationFilter(value,alias='a'){return !value||value==='all'?'':` AND ${alias}.configuration_version='${id(value)}'`;}
export function riskSQL(configuration='all'){
 return `SELECT l.location_id,l.location_name,l.floor,COUNT(a.action_id) total,COUNT_IF(a.status='FAILED') failed,
 ROUND(100.0*COUNT_IF(a.status='FAILED')/NULLIF(COUNT(a.action_id),0),1) failure_rate,
 COUNT(DISTINCT a.mission_id) missions,COUNT(DISTINCT CASE WHEN a.status='FAILED' THEN a.mission_id END) failed_missions,
 MAX(a.timestamp) last_visit
 FROM ${table('locations')} l LEFT JOIN ${table('actions')} a ON l.location_id=a.location_id${configurationFilter(configuration)}
 GROUP BY l.location_id,l.location_name,l.floor ORDER BY failure_rate DESC NULLS LAST,l.location_id`;
}
export const features={
 risk:configuration=>query(riskSQL(configuration)),
 waypoint:async(location,configuration)=>{
 const where=`a.location_id='${id(location)}'${configurationFilter(configuration)}`;
 const [assets,missions,actions]=await Promise.all([
 query(`SELECT a.asset_id,MAX(s.asset_name) asset_name,COUNT(*) inspections,COUNT_IF(a.status='FAILED') failures FROM ${table('actions')} a LEFT JOIN ${table('assets')} s ON a.asset_id=s.asset_id WHERE ${where} GROUP BY a.asset_id ORDER BY failures DESC,a.asset_id`),
 query(`SELECT a.mission_id,MAX(m.mission_status) mission_status,MAX(m.configuration_version) configuration_version,MAX(a.timestamp) visited_at,COUNT(*) inspections,COUNT_IF(a.status='FAILED') failures FROM ${table('actions')} a JOIN ${table('missions')} m ON a.mission_id=m.mission_id WHERE ${where} GROUP BY a.mission_id ORDER BY visited_at DESC`),
 query(`SELECT a.*,s.asset_name FROM ${table('actions')} a LEFT JOIN ${table('assets')} s ON a.asset_id=s.asset_id WHERE ${where} AND a.status='FAILED' ORDER BY a.timestamp DESC`)]);
 return {assets,missions,actions};
 },
 trends:async()=>{
 const [series,readings]=await Promise.all([
 query(`SELECT asset_id,MAX(asset_name) asset_name,measurement_type,unit,COUNT(*) reading_count,COUNT_IF(warning) warning_count,COUNT_IF(signal_status='RECURRING') recurring_count,COUNT_IF(quality<>'GOOD' OR quality IS NULL) quality_count,MAX(timestamp) latest_timestamp FROM ${table('sensor_history')} GROUP BY asset_id,measurement_type,unit ORDER BY warning_count DESC,reading_count DESC,asset_id,measurement_type,unit`),
 query(`SELECT * FROM ${table('sensor_history')} ORDER BY timestamp,reading_id`)]);return {series,readings};
 },
 report:async(mission)=>{
 const key=id(mission);
 const [health,actions,anomalies,readings,risks]=await Promise.all([
 query(`SELECT * FROM ${table('mission_health')} WHERE mission_id='${key}'`),
 query(`SELECT a.*,s.asset_name,l.location_name FROM ${table('actions')} a LEFT JOIN ${table('assets')} s ON a.asset_id=s.asset_id LEFT JOIN ${table('locations')} l ON a.location_id=l.location_id WHERE a.mission_id='${key}' ORDER BY a.sequence,a.timestamp`),
 query(`SELECT * FROM ${table('anomaly_priority')} WHERE mission_id='${key}' ORDER BY severity_rank DESC,timestamp`),
 query(`SELECT * FROM ${table('sensor_history')} WHERE mission_id='${key}' ORDER BY timestamp,reading_id`),
 query(`SELECT * FROM ${table('waypoint_risk')} WHERE location_id IN (SELECT DISTINCT location_id FROM ${table('actions')} WHERE mission_id='${key}') ORDER BY failure_rate DESC NULLS LAST`)]);
 if(!health.length)throw Error('Mission not found in Databricks');
 return {health:health[0],actions,anomalies,readings,risks,source:'Databricks SQL',generated_at:new Date().toISOString()};
 }
};
