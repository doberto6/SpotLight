import fs from 'node:fs';
import path from 'node:path';
export const kit=path.resolve('data/SPOT_KnightHacks_Challenge_Kit Part One');
export function parseCSV(text) {
 const rows=[]; let row=[], cell='', quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const headers=rows.shift();return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function analytics(d){
 const grouped=key=>Object.values(d.actions.reduce((a,r)=>{const k=r[key];a[k]??={key:k,total:0,failed:0,success:0};a[k].total++;a[k].failed+=r.status==='FAILED';a[k].success+=r.status==='SUCCESS';return a;},{})).map(r=>({...r,failureRate:r.failed/r.total*100,successRate:r.success/r.total*100})).sort((a,b)=>b.failureRate-a.failureRate);
 return {missions:d.missions.length,completed:d.missions.filter(m=>m.mission_status==='COMPLETED').length,completedWithFailures:d.missions.filter(m=>m.mission_status==='COMPLETED'&&d.actions.some(a=>a.mission_id===m.mission_id&&a.status==='FAILED')).length,review:d.anomalies.filter(a=>a.operator_review_required==='True').length,critical:d.anomalies.filter(a=>a.severity==='CRITICAL').length,byLocation:grouped('location_id'),byType:grouped('action_type'),byConfiguration:grouped('configuration_version')};
}
export function loadData(){const d={};for(const table of ['missions','actions','readings','anomalies','locations','assets'])d[table]=parseCSV(fs.readFileSync(path.join(kit,'02_DATA',table+'.csv'),'utf8'));d.events=fs.readFileSync(path.join(kit,'02_DATA/replay.ndjson'),'utf8').trim().split(/\r?\n/).map(JSON.parse).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.event_id.localeCompare(b.event_id));
 for(const table of ['actions','readings','anomalies'])for(const r of d[table]){if(!d.missions.some(m=>m.mission_id===r.mission_id))throw Error('Unknown mission '+r.mission_id);if(!d.locations.some(l=>l.location_id===r.location_id))throw Error('Unknown location '+r.location_id);}
 for(const table of ['readings','anomalies'])for(const r of d[table])if(!d.actions.some(a=>a.action_id===r.action_id))throw Error('Unknown action '+r.action_id);
 d.metrics=analytics(d);return d;}
export function hotspotSQL(catalog,schema){for(const v of [catalog,schema])if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw Error('Invalid catalog/schema identifier');return `SELECT location_id, COUNT(*) AS total, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed FROM ${catalog}.${schema}.actions GROUP BY location_id ORDER BY failed / total DESC`;}
