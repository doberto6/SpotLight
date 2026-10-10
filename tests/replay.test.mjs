import test from 'node:test';
import assert from 'node:assert/strict';
import {loadData} from '../data.mjs';
import {initialReplayState,replayReducer,buildReplay,sampleReplay,stepManual,blocked,routeBetween,worldPoint,stamp} from '../src/replay-engine.mjs';
import {blockedPose,SPOT_COLLISION} from '../src/spot-collision.mjs';

test('takeover pauses recorded time; returning restores replay without changing the recording',()=>{
  let state=replayReducer(initialReplayState(),{type:'seek',time:60,duration:120});
  state=replayReducer(state,{type:'play',duration:120});
  state=replayReducer(state,{type:'takeover'});
  assert.equal(state.manual,true);assert.equal(state.playing,false);
  assert.deepEqual(replayReducer(state,{type:'tick',dt:10,duration:120}),state);
  const returned=replayReducer(state,{type:'return'});assert.equal(returned.time,60);assert.equal(returned.manual,false);assert.equal(returned.playing,false);
  const resumed=replayReducer(state,{type:'resume',duration:120});assert.equal(resumed.time,60);assert.equal(resumed.playing,true);assert.equal(resumed.manual,false);
});
test('speed, scrubbing, completion and mode switches preserve valid replay state',()=>{
  let state=replayReducer(initialReplayState(),{type:'speed',speed:4});
  state=replayReducer(state,{type:'play',duration:10});state=replayReducer(state,{type:'tick',dt:3,duration:10});
  assert.equal(state.time,10);assert.equal(state.playing,false);
  state=replayReducer(state,{type:'play',duration:10});assert.equal(state.time,0);
  state=replayReducer(state,{type:'seek',time:-10,duration:10});assert.equal(state.time,0);assert.equal(state.playing,false);
  state=replayReducer(state,{type:'takeover'});state=replayReducer(state,{type:'mode',mode:'simulation'});assert.equal(state.manual,false);assert.equal(state.mode,'simulation');
});
test('manual movement accelerates, turns and stops without passing through obstacles or plant boundaries',()=>{
  let pose={x:0,z:0,yaw:0,speed:0};const wall=[{x:2,z:0,w:1,d:20}];
  for(let i=0;i<100;i++)pose=stepManual(pose,{forward:1,backward:0,left:0,right:0},.05,wall);
  assert.ok(pose.x>0);assert.ok(pose.x<=1.5-SPOT_COLLISION.halfLength);assert.equal(pose.blocked,true);assert.equal(blockedPose(pose,wall),false);
  const turned=stepManual({...pose,x:.2},{forward:0,backward:0,left:1,right:0},.05,wall);assert.ok(turned.yaw>pose.yaw);
  const stopped=stepManual({...pose,speed:2},{stop:true},.05,wall);assert.equal(stopped.speed,0);assert.equal(stopped.x,pose.x);
  pose={x:39.3,z:0,yaw:0,speed:2};for(let i=0;i<20;i++)pose=stepManual(pose,{forward:1,backward:0,left:0,right:0},.05,[]);assert.ok(pose.x<=40-SPOT_COLLISION.halfLength);
});
test('recorded visits interpolate at timestamps and paths remain traversable across every mission',()=>{
  const data=loadData();
  for(const mission of data.missions){
    const actions=data.actions.filter(a=>a.mission_id===mission.mission_id),events=data.events.filter(e=>e.mission_id===mission.mission_id);
    const replay=buildReplay(mission,actions,events);
    assert.equal(replay.duration,(stamp(mission.end_time)-stamp(mission.start_time))/1000);
    for(const action of actions){const p=sampleReplay(replay,(stamp(action.timestamp)-replay.start)/1000),expected=worldPoint(action.location_id);assert.ok(Math.hypot(p.x-expected.x,p.z-expected.z)<.001);}
    for(const seg of replay.segments)assert.ok(seg.path.every(p=>!blocked(p.x,p.z,undefined,.65)));
  }
});
test('routing goes around an obstacle rather than crossing through it',()=>{
  const solids=[{x:0,z:0,w:2,d:4}],path=routeBetween({x:-5,z:0},{x:5,z:0},solids);
  assert.ok(path.length>2);assert.ok(path.some(p=>Math.abs(p.z)>2));assert.ok(path.every(p=>!blocked(p.x,p.z,solids)));
});
test('Spot stands during a recorded inspection and moves between visits',()=>{
  const mission={start_time:'2026-09-01T00:00:00',end_time:'2026-09-01T00:10:00'};
  const replay=buildReplay(mission,[{action_id:'a',location_id:'WP05',timestamp:'2026-09-01T00:01:00',duration_sec:30},{action_id:'b',location_id:'WP03',timestamp:'2026-09-01T00:05:00',duration_sec:30}],[]);
  assert.equal(sampleReplay(replay,70).speed,0);assert.deepEqual({x:sampleReplay(replay,70).x,z:sampleReplay(replay,70).z},worldPoint('WP05'));
  assert.ok(sampleReplay(replay,200).speed>0);assert.equal(sampleReplay(replay,310).speed,0);
});
