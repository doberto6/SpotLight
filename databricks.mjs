import {DBSQLClient} from '@databricks/sql';

const identifier=/^[A-Za-z_][A-Za-z0-9_]*$/;
export const dbConfig=()=>({host:String(process.env.DATABRICKS_HOST||'').replace(/^https?:\/\//,'').replace(/\/$/,''),path:`/sql/1.0/warehouses/${process.env.DATABRICKS_WAREHOUSE_ID||''}`,token:process.env.DATABRICKS_TOKEN||'',catalog:process.env.DATABRICKS_CATALOG||'workspace',schema:process.env.DATABRICKS_SCHEMA||'spotlight'});
export function table(name){const c=dbConfig();if(!identifier.test(c.catalog)||!identifier.test(c.schema)||!identifier.test(name))throw Error('Invalid Databricks identifier');return `${c.catalog}.${c.schema}.${name}`;}
export async function query(sql){const c=dbConfig();if(!c.host||!c.token||!process.env.DATABRICKS_WAREHOUSE_ID)throw Error('Databricks credentials are not configured');
  const client=new DBSQLClient();let session,operation;
  try{await client.connect({host:c.host,path:c.path,token:c.token});session=await client.openSession();operation=await session.executeStatement(sql,{runAsync:true});return await operation.fetchAll();}
  finally{try{await operation?.close();}finally{try{await session?.close();}finally{await client.close();}}}
}
export const queries={
 overview:async()=>{const [missions,hotspots,anomalies,reliability]=await Promise.all([
 query(`SELECT * FROM ${table('mission_health')} ORDER BY review_required DESC,start_time DESC`),
 query(`SELECT * FROM ${table('waypoint_risk')} ORDER BY failure_rate DESC NULLS LAST`),
 query(`SELECT * FROM ${table('anomaly_priority')} ORDER BY severity_rank DESC,operator_review_required DESC,timestamp DESC`),
 query(`SELECT * FROM ${table('configuration_reliability')} ORDER BY configuration_version,configuration_total DESC,action_type`)]);return {missions,hotspots,anomalies,reliability};},
 evidence:async(kind,id)=>{if(!['mission','waypoint','action'].includes(kind)||!/^[-A-Za-z0-9_]{1,80}$/.test(id))throw Error('Invalid evidence selection');const column={mission:'mission_id',waypoint:'location_id',action:'action_id'}[kind];const [actions,readings,anomalies]=await Promise.all(['actions','readings','anomalies'].map(name=>query(`SELECT * FROM ${table(name)} WHERE ${column}='${id}' ORDER BY timestamp DESC`)));return {actions,readings,anomalies};},
 health:()=>query('SELECT 1 AS connected, current_timestamp() AS checked_at'),
 missions:()=>query(`SELECT mission_id, mission_status, scenario, configuration_version, start_time, end_time, duration_min FROM ${table('missions')} ORDER BY start_time DESC`),
 hiddenFailures:()=>query(`SELECT m.mission_id, m.mission_status, a.action_id, a.location_id, a.action_type, a.status, a.failure_type, a.timestamp FROM ${table('actions')} a JOIN ${table('missions')} m ON a.mission_id=m.mission_id WHERE a.status='FAILED' ORDER BY a.timestamp DESC`),
 hotspots:()=>query(`SELECT location_id, COUNT(*) AS total, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) AS failed, ROUND(100.0*SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END)/COUNT(*),1) AS failure_rate FROM ${table('actions')} GROUP BY location_id ORDER BY failure_rate DESC`),
 anomalies:()=>query(`SELECT anomaly_id, mission_id, action_id, location_id, asset_id, anomaly_type, severity, description, operator_review_required, timestamp FROM ${table('anomalies')} ORDER BY timestamp DESC`),
 reliability:()=>query(`SELECT configuration_version, COUNT(*) AS total_actions, SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) AS successful_actions, ROUND(100.0*SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END)/COUNT(*),1) AS success_rate FROM ${table('actions')} GROUP BY configuration_version ORDER BY configuration_version`)
};
