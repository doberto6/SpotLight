import fs from 'node:fs';
import {query,table,warehouseHealth} from '../databricks.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
console.log(JSON.stringify(await warehouseHealth()));
for(const name of ['actions','missions','locations','assets','readings','anomalies']){
 console.log(name,JSON.stringify(await query(`DESCRIBE TABLE ${table(name)}`)));
}
console.log('statuses',JSON.stringify(await query(`SELECT status,COUNT(*) n,COUNT_IF(TRY_CAST(timestamp AS TIMESTAMP) IS NULL) invalid_time FROM ${table('actions')} GROUP BY status`)));
console.log('missions',JSON.stringify(await query(`SELECT mission_id,configuration_version,start_time,end_time FROM ${table('missions')} ORDER BY start_time`)));
console.log('relationships',JSON.stringify(await query(`SELECT COUNT(*) actions,COUNT(DISTINCT a.action_id) unique_actions,COUNT_IF(m.mission_id IS NULL) missing_missions,COUNT_IF(l.location_id IS NULL) missing_locations,COUNT_IF(s.asset_id IS NULL AND a.asset_id IS NOT NULL) missing_assets FROM ${table('actions')} a LEFT JOIN ${table('missions')} m ON a.mission_id=m.mission_id LEFT JOIN ${table('locations')} l ON a.location_id=l.location_id LEFT JOIN ${table('assets')} s ON a.asset_id=s.asset_id`)));
