import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataGateway} from '../data-gateway.mjs';
import {createDemoData} from '../demo-data.mjs';
import {loadData} from '../data.mjs';
import {validPrediction} from '../ml-queries.mjs';

test('stopped, starting, missing credentials and forced demo never submit SQL',async()=>{
 for(const state of ['STOPPED','STARTING','STOPPING','UNKNOWN','error','forced']){
  let checked=0,queries=0;const headers={};
  const gate=createDataGateway({mode:state==='forced'?'demo':'auto',health:async()=>{checked++;if(state==='error')throw Error('no credentials');return {state};}});
  const value=await gate.run(()=>{queries++;return 'live';},()=>['bundled'],{setHeader:(key,v)=>headers[key]=v});
  assert.deepEqual(value,['bundled']);assert.equal(queries,0);assert.equal(checked,state==='forced'?0:1);assert.equal(headers['X-SPOTlight-Data-Mode'],'demo');
 }
});
test('running warehouse uses live results, coalesces checks and recovers after a stop',async()=>{
 let state='STOPPED',clock=0,checks=0;
 const gate=createDataGateway({health:async()=>{checks++;return {state};},now:()=>clock,ttl:100});
 const run=()=>gate.run(()=>({source:'real',rows:[42]}),()=>({source:'demo',rows:[1]}));
 assert.equal((await run()).source,'demo');state='RUNNING';clock=101;
 const values=await Promise.all([run(),run(),run()]);assert.ok(values.every(r=>r.source==='real'));assert.equal(checks,2);
});
test('query failure opens a short demo circuit; strict live mode surfaces errors',async()=>{
 let calls=0,clock=0;const gate=createDataGateway({health:async()=>({state:'RUNNING'}),now:()=>clock,ttl:100});
 const live=()=>{calls++;throw Error('network failure');};
 assert.equal(await gate.run(live,()=>1),1);assert.equal(await gate.run(live,()=>2),2);assert.equal(calls,1);
 clock=101;assert.equal(await gate.run(()=>3,()=>4),3);
 const strict=createDataGateway({health:async()=>({state:'STOPPED'}),mode:'live'});
 await assert.rejects(strict.run(live,()=>4),/Live-only/);
});
const raw=loadData(),demo=createDemoData(raw);
test('demo mission health, priorities and evidence retain the challenge record IDs and counts',()=>{
 const view=demo.overview();assert.equal(view.missions.length,27);assert.equal(view.missions.reduce((n,m)=>n+m.total_actions,0),270);assert.equal(view.missions.reduce((n,m)=>n+m.failed_actions,0),49);
 assert.ok(view.anomalies.every(a=>typeof a.operator_review_required==='boolean'));
 const mission=view.missions.find(m=>m.hidden_failure);assert.ok(mission.review_required);assert.equal(demo.report(mission.mission_id).actions.length,mission.total_actions);
 const waypoint=demo.risk('V1').find(w=>w.total);assert.equal(waypoint.failed,raw.actions.filter(a=>a.location_id===waypoint.location_id&&a.configuration_version==='V1'&&a.status==='FAILED').length);
 assert.ok(demo.waypoint(waypoint.location_id,'V1').actions.every(a=>a.configuration_version==='V1'));
 assert.ok(demo.evidence('mission',mission.mission_id).actions.every(a=>a.mission_id===mission.mission_id));
 assert.throws(()=>demo.report('notfound'),/not found/);assert.throws(()=>demo.waypoint("WP01' OR 1=1"),/Invalid/);
 assert.equal(JSON.stringify(loadData().readings),JSON.stringify(raw.readings));
});
test('sensor demo windows exclude current and questionable readings and retain recurrence',()=>{
 const data=structuredClone(raw);data.readings=Array.from({length:6},(_,i)=>({...raw.readings[0],reading_id:`R${i}`,timestamp:`2026-01-01T00:0${i}:00`,quality:i===3?'QUESTIONABLE':'GOOD',value:String([10,10,10,100,20,30][i])}));
 const rows=createDemoData(data).trends().readings;
 assert.equal(rows[3].signal_status,'QUALITY_REVIEW');assert.equal(rows[4].baseline_count,3);assert.equal(rows[4].baseline_mean,10);assert.equal(rows[4].signal_status,'ISOLATED');assert.equal(rows[5].signal_status,'RECURRING');assert.equal(rows[5].baseline_mean,12.5);
 assert.equal(demo.trends().readings.length,220);
});
test('saved forecasts retain actual validation and probabilities and are labeled as a snapshot',()=>{
 const ml=demo.ml.overview();assert.equal(ml.rows.length,ml.model.candidate_count);assert.equal(ml.status.mode,'demo');assert.match(ml.source,/snapshot/);assert.equal(ml.model.evaluation.recall,0);
 ml.rows.forEach(validPrediction);assert.ok(demo.ml.predictions('WP09').rows.every(r=>r.location_id==='WP09'));
});
test('offline Spot Talk provides cited records and map destinations without AI claims',()=>{
 const answer=demo.chat({question:'What went wrong in M006?',mission:'all'});
 assert.equal(answer.model,null);assert.equal(answer.mode,'demo');assert.match(answer.answer,/no AI model/);assert.ok(answer.sources.some(s=>s.record.location_id));assert.ok(answer.sources.every(s=>answer.answer.includes(`[${s.key}]`)));
 assert.ok(answer.sources.filter(s=>s.mission_id).every(s=>s.mission_id==='M006'));
 assert.match(demo.chat({question:'Compare V1 and V2'}).answer,/V1:.*actions failed/);
});
