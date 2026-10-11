import fs from 'node:fs';
import assert from 'node:assert/strict';
import {query,table,dbConfig} from '../databricks.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const {catalog,schema}=dbConfig();
// Apply the readable result-view columns without retraining or changing raw data.
const sql=fs.readFileSync('databricks/ml_predictions.sql','utf8').replaceAll('workspace.spotlight',`${catalog}.${schema}`).replace(/^--.*$/gm,'');
for(const statement of sql.split(';').filter(s=>s.trim()))await query(statement);
const get=async endpoint=>{const response=await fetch(`http://localhost:${process.env.PORT||3000}${endpoint}`,{signal:AbortSignal.timeout(60000)});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;};
const health=await get('/api/health');assert.equal(health.status,'ok');
const result=await get('/api/ml/overview');assert.equal(result.status.state,'ready');
const metrics=await get('/api/ml/metrics');assert.equal(metrics.model.model_version,result.model.model_version);
const wp=await get('/api/ml/predictions/WP09');assert.ok(wp.rows.length);assert.ok(wp.rows.every(r=>r.location_id==='WP09'));
const all=await get('/api/ml/predictions');assert.equal(all.rows.length,result.model.candidate_count);
const status=await get('/api/ml/status');assert.equal(status.model_version,result.model.model_version);
const direct=await query(`SELECT target_id,predicted_failure_probability,historical_failure_rate FROM ${table('ml_predictions')} WHERE model_version='${result.model.model_version}' ORDER BY predicted_failure_probability DESC,target_id`);
assert.equal(direct.length,result.rows.length);
for(let i=0;i<direct.length;i++){
 assert.equal(direct[i].target_id,result.rows[i].target_id);
 assert.equal(Number(direct[i].predicted_failure_probability),result.rows[i].predicted_failure_probability);
}
const existing=await get('/api/databricks/overview');assert.ok(existing.missions.length);
const dataset=await get('/api/data');assert.ok(dataset.events.length);
console.log(JSON.stringify({health:'ok',source:'Databricks Delta; SQL rows match API exactly',version:result.model.model_version,candidates:result.rows.length,waypoint_candidates:wp.rows.length,existing_missions:existing.missions.length,replay_events:dataset.events.length,metrics:result.model.evaluation}));
