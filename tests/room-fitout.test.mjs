import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadData} from '../data.mjs';
import {roomStations,doorOpenings,workshop} from '../src/room-fitout.mjs';
import {inspectionTargets,inspectionSnapshot} from '../src/inspection-assets.mjs';
import {SPOT_COLLISION} from '../src/spot-collision.mjs';
import {stamp} from '../src/replay-engine.mjs';

test('all room stations sit above SPOT and signs fit on their wall segments',()=>{
 assert.equal(roomStations.length,15);
 for(const p of roomStations){assert.ok(p.baseY>SPOT_COLLISION.height);assert.ok(p.width<=Math.max(p.wall.w,p.wall.d));assert.ok(p.identity.every(Boolean));}
 for(const d of doorOpenings()){
  assert.ok(d.baseY>SPOT_COLLISION.height);assert.ok(d.width>=1);
  const along=d.horizontal?'x':'z',dimension=d.horizontal?'w':'d';
  for(const [i,w] of d.walls.entries()){const center=d[along]+(i===0?-1:1)*(d.width/2+.035);assert.ok(Math.abs(center-w[along])+.0325<=w[dimension]/2+.003);}
 }
});
test('Blender fitout models fit the maintenance pad and stay within a small geometry budget',()=>{
 const root=new URL('../public/models/fitout/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
 assert.equal(manifest.length,2);assert.ok(manifest.reduce((n,m)=>n+m.bytes,0)<300000);
 for(const model of manifest){const file=fs.readFileSync(new URL(model.name+'.glb',root));assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.length,model.bytes);assert.equal(model.license,'CC0-1.0');assert.ok(model.triangles<3500);}
 const bench=manifest.find(m=>m.name==='maintenance_workbench');
 assert.ok(bench.bounds.max[1]-bench.bounds.min[1]<workshop.w);
 assert.ok(bench.bounds.max[0]-bench.bounds.min[0]<workshop.d);
 assert.ok(bench.bounds.max[2]+.22<workshop.h);
 const hoist=manifest.find(m=>m.name==='bridge_hoist');assert.ok(4.11+hoist.bounds.min[2]>4);assert.ok(4.11+hoist.bounds.max[2]<5.4);
});
test('inspection targets retain source asset IDs and recorded location pairs in every mission',()=>{
 const data=loadData();
 for(const mission of data.missions){const actions=data.actions.filter(a=>a.mission_id===mission.mission_id),targets=inspectionTargets(data.assets,actions);assert.equal(new Set(targets.map(t=>t.key)).size,targets.length);
  for(const a of actions)assert.ok(targets.some(t=>t.asset_id===a.asset_id&&t.location_id===a.location_id));
  for(const t of targets){assert.ok(t.position.every(Number.isFinite));assert.ok(t.position[1]-.16>SPOT_COLLISION.height);
   if(t.pad){assert.ok(Math.abs(t.position[0]-t.pad.x)<t.pad.w/2);assert.ok(Math.abs(t.position[2]-t.pad.z)<t.pad.d/2);}
  }
 }
});
test('inspection snapshots never reveal future readings, findings or a completed inspection early',()=>{
 const data=loadData(),actions=data.actions.filter(a=>a.mission_id==='M006'),records={actions,readings:data.readings.filter(r=>r.mission_id==='M006'),anomalies:data.anomalies.filter(r=>r.mission_id==='M006')};
 const target=inspectionTargets(data.assets,actions).find(t=>t.asset_id==='PANEL-203'),action=actions.find(a=>a.asset_id===target.asset_id),at=stamp(action.timestamp);
 const before=inspectionSnapshot(target,records,at-1);assert.equal(before.status,'pending');assert.equal(before.action,null);assert.deepEqual(before.readings,[]);assert.deepEqual(before.findings,[]);
 const during=inspectionSnapshot(target,records,at);assert.equal(during.action.action_id,action.action_id);assert.ok(during.readings.every(r=>r.action_id===action.action_id&&stamp(r.timestamp)<=at));assert.notEqual(during.status,'inspected');
 const end=inspectionSnapshot(target,records,Infinity);assert.ok(end.findings.every(r=>r.asset_id===target.asset_id&&r.location_id===target.location_id));assert.ok(end.readings.length>0);
 assert.deepEqual(inspectionSnapshot(target,records,at-1),before);
});
