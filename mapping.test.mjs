import test from 'node:test';
import assert from 'node:assert/strict';
import {loadData} from './data.mjs';
import {mappingData} from './src/mapping-data.mjs';
test('mapping route and replay match the queue on every available date',()=>{
  const data=loadData();
  for(const day of new Set(data.missions.map(m=>m.start_time.slice(0,10)))){
    const result=mappingData(data,{day,period:'day',severity:'all',review:false,scope:'all',location:'all',asset:'all'});
    const ids=new Set(result.anomalies.map(a=>a.action_id));
    assert.deepEqual(new Set(result.actions.map(a=>a.action_id)),ids);
    assert.ok(result.anomalies.every(a=>a.timestamp.startsWith(day)));
    assert.ok(result.events.every(e=>ids.has(e.details.action_id)));
    assert.ok(result.actions.every((a,i)=>i===0||a.timestamp>=result.actions[i-1].timestamp));
  }
});
test('empty date prevents mapping playback and severity filters constrain the route',()=>{
  const data=loadData(),options={day:'',period:'day',severity:'HIGH',review:false,scope:'all',location:'all',asset:'all'};
  assert.equal(mappingData(data,options).events.length,0);
  const result=mappingData(data,{...options,day:'2026-09-03'});
  assert.ok(result.anomalies.every(a=>a.severity==='HIGH'));
  assert.ok(result.actions.every(a=>result.anomalies.some(n=>n.action_id===a.action_id)));
});
