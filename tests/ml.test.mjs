import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMLQueries,handleML,validPrediction,publishSQL} from '../ml-queries.mjs';
const row={target_id:'WP01|A1|THERMAL',location_id:'WP01',predicted_failure_probability:.31,risk_category:'Elevated',historical_sample_size:10,historical_failure_rate:.2,model_version:'lr-test-123'};
test('stored forecasts reject invalid probabilities and categories',()=>{
 for(const value of [NaN,Infinity,-.01,1.01,'0.3'])assert.throws(()=>validPrediction({...row,predicted_failure_probability:value}));
 assert.throws(()=>validPrediction({...row,risk_category:'Lower'}));assert.equal(validPrediction(row),row);
});
test('publication commits metrics and forecasts together and encodes values safely',()=>{
 const sql=publishSQL({metrics:{model_version:row.model_version},predictions:[{...row,target_id:"a'); DROP TABLE actions;--"}]});
 assert.ok(sql.startsWith('INSERT INTO workspace.spotlight.ml_runs SELECT'));
 assert.ok(sql.includes("'metrics'")&&sql.includes("'prediction'"));assert.ok(!sql.includes('DROP TABLE'));
 assert.throws(()=>publishSQL({metrics:{model_version:row.model_version},predictions:[{...row,model_version:'lr-other'}]}));
});
test('missing tables show not-trained; connection failures never become forecasts',async()=>{
 const missing=createMLQueries(async()=>{throw Error('[TABLE_OR_VIEW_NOT_FOUND]');});
 assert.equal((await missing.status()).state,'not_trained');assert.deepEqual((await missing.predictions()).rows,[]);
 const failed=createMLQueries(async()=>{throw Error('Warehouse unavailable');});
 await assert.rejects(failed.predictions(),/Warehouse unavailable/);
});
test('API rejects mutations and unsafe location IDs, surfaces query errors',async()=>{
 let calls=0;const queries={status:async()=>{calls++;throw Error('Network failure');}};
 const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}});
 let res=response();await handleML({method:'GET'},res,new URL('http://local/api/ml/status'),queries);assert.equal(res.statusCode,502);assert.match(res.body.error,/Network failure/);
 res=response();await handleML({method:'GET'},res,new URL('http://local/api/ml/predictions/WP01%27'),queries);assert.equal(res.statusCode,404);assert.equal(calls,1);
 res=response();await handleML({method:'POST'},res,new URL('http://local/api/ml/status'),queries);assert.equal(res.statusCode,405);
});
test('SQL histories require completed earlier missions and exclude post-action predictors',()=>{
 const sql=readFileSync(new URL('../databricks/ml_features.sql',import.meta.url),'utf8');
 assert.match(sql,/h\.outcome_at<b\.cutoff_at AND h\.mission_end<b\.cutoff_at/);assert.match(sql,/h\.mission_id<>b\.mission_id/);assert.match(sql,/a\.status IN \('FAILED','SUCCESS'\)/);
 assert.ok(!sql.includes('mission_status')&&!sql.includes('anomalies')&&!sql.includes('readings'));
});
