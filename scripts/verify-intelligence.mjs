// Live regression check. Run with node --env-file=.env scripts/verify-intelligence.mjs.
import assert from 'node:assert/strict';
import {features} from '../intelligence-queries.mjs';
import {query,table} from '../databricks.mjs';
const actions=await query(`SELECT * FROM ${table('actions')}`);
for(const config of ['all',...new Set(actions.map(a=>a.configuration_version))]){
 const rows=await features.risk(config);
 for(const row of rows){const expected=actions.filter(a=>a.location_id===row.location_id&&(config==='all'||a.configuration_version===config));assert.equal(Number(row.total),expected.length);assert.equal(Number(row.failed),expected.filter(a=>a.status==='FAILED').length);assert.equal(Number(row.failed_missions),new Set(expected.filter(a=>a.status==='FAILED').map(a=>a.mission_id)).size);}
}
const trends=await features.trends(),groups=Map.groupBy(trends.readings,r=>[r.asset_id,r.measurement_type,r.unit].join('|'));
for(const group of groups.values()){
 group.sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime()||a.reading_id.localeCompare(b.reading_id));
 const flags=[];
 group.forEach((r,index)=>{
 const earlier=group.slice(Math.max(0,index-10),index).filter(p=>p.quality==='GOOD'&&p.value!=null).map(p=>Number(p.value));
 assert.equal(Number(r.baseline_count),earlier.length,`${r.reading_id}: baseline count`);
 if(earlier.length){const mean=earlier.reduce((a,b)=>a+b,0)/earlier.length;assert.ok(Math.abs(Number(r.baseline_mean)-mean)<1e-6,`${r.reading_id}: baseline must exclude current/future readings`);const sd=Math.sqrt(earlier.reduce((a,b)=>a+(b-mean)**2,0)/earlier.length);const warning=earlier.length>=3&&r.quality==='GOOD'&&r.value!=null&&(sd>1e-9?Math.abs(Number(r.value)-mean)>2*sd:Math.abs(Number(r.value)-mean)>Math.max(Math.abs(mean)*.1,.000001));assert.equal(r.warning,warning,`${r.reading_id}: warning`);}
 else assert.equal(r.warning,false);
 flags.push(r.warning);assert.equal(Number(r.recent_warning_count),flags.slice(-5).filter(Boolean).length);
 });
}
const report=await features.report('M006');assert.equal(report.health.mission_id,'M006');assert.ok(report.actions.every(a=>a.mission_id==='M006'));assert.ok(report.readings.every(r=>report.actions.some(a=>a.action_id===r.action_id)));
const waypoint=await features.waypoint('WP09','all');assert.equal(waypoint.actions.length,actions.filter(a=>a.location_id==='WP09'&&a.status==='FAILED').length);
console.log(`Verified heatmap counts across configurations, ${trends.readings.length} historical baselines and warning flags, waypoint drilldown, and mission report evidence.`);
