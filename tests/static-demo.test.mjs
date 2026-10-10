import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadData} from '../data.mjs';
import {buildReplay,buildDemo,sourceTime,timelineTime,sampleReplay,blocked,clearSegment} from '../src/replay-engine.mjs';
import {createStaticMissionPath} from '../src/static-mission-path.js';
import {wallFootprint,wallSurface} from '../src/facility-structure.mjs';
import {obstacles} from '../src/facility-layout.mjs';

test('every demo is 75 seconds, retains source evidence order and arrival locations without mutating data',()=>{
 const data=loadData(),before=JSON.stringify(data);
 for(const mission of data.missions){const recorded=buildReplay(mission,data.actions.filter(a=>a.mission_id===mission.mission_id),data.events.filter(a=>a.mission_id===mission.mission_id)),findings=data.anomalies.filter(a=>a.mission_id===mission.mission_id),demo=buildDemo(recorded,findings);
  assert.equal(demo.duration,75);assert.equal(demo.visits.length,recorded.visits.length);assert.equal(demo.events.length,recorded.events.length);assert.equal(demo.findings.length,findings.length);
  for(const visit of demo.visits){const pose=sampleReplay(demo,visit.at/1000);assert.ok(Math.hypot(pose.x-visit.x,pose.z-visit.z)<.001);assert.equal(visit.timestamp,recorded.visits.find(v=>v.action_id===visit.action_id).timestamp);}
  for(const event of demo.events)assert.ok(Math.abs(sourceTime(demo,event.at)-event.sourceAt)<1e-6);
  for(const finding of demo.findings)assert.ok(Math.abs(sourceTime(demo,finding.at)-finding.sourceAt)<1e-6);
  assert.ok(demo.events.every((e,i)=>!i||e.at>=demo.events[i-1].at));assert.ok(demo.findings.every((e,i)=>!i||e.at>=demo.findings[i-1].at));
  for(let source=0;source<=recorded.duration;source+=3.7)assert.ok(Math.abs(sourceTime(demo,timelineTime(demo,source))-source)<1e-6);
  for(const segment of demo.segments){if(segment.transfer||segment.unreachable)continue;assert.ok(segment.path.every((p,i)=>!blocked(p.x,p.z)&&(!i||clearSegment(segment.path[i-1],p))));}
 }
 assert.equal(JSON.stringify(data),before);
});

test('static path buffers, instance identities, white colors and opacity survive arbitrary progress and visibility changes',()=>{
 const data=loadData(),mission=data.missions[0],replay=buildReplay(mission,data.actions.filter(a=>a.mission_id===mission.mission_id),[]),resources=[],path=createStaticMissionPath(new THREE.Scene(),resources,replay),snapshot=path.snapshot();assert.ok(snapshot.some(s=>s.count>0));
 for(let i=0;i<100;i++){sampleReplay(replay,i*10);path.setVisible(['all','1','2'][i%3],i%2===0);const after=path.snapshot();after.forEach((s,j)=>{for(const key of ['id','count','version','hash','color','opacity'])assert.equal(s[key],snapshot[j][key]);assert.equal(s.color,'ffffff');assert.equal(s.opacity,1);});}
 path.setVisible('all',false);assert.ok(path.snapshot().every(s=>!s.visible));path.setVisible('2',true);assert.equal(path.snapshot()[0].visible,false);assert.equal(path.snapshot()[1].visible,true);
 for(const r of new Set(resources))r.dispose();
});

test('wall union removes internal intersection faces and has correct outward normals and nonoverlapping caps',()=>{
 const footprint=wallFootprint([{x:0,z:0,w:4,d:1},{x:0,z:0,w:1,d:4}]);const area=footprint.caps.reduce((s,c)=>s+(c.x1-c.x0)*(c.z1-c.z0),0);assert.equal(area,7);
 const data=wallSurface(footprint,-.035,6.4);for(let i=0;i<data.indices.length;i+=3){const ids=data.indices.slice(i,i+3),p=ids.map(n=>data.positions.slice(n*3,n*3+3)),a=new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])),b=new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0])),normal=new THREE.Vector3(...data.normals.slice(ids[0]*3,ids[0]*3+3));assert.ok(a.cross(b).dot(normal)>0);}
 for(const floor of ['1','2']){const plan=wallFootprint(obstacles.filter(o=>o.type==='wall'&&o.floor===floor));for(const edge of plan.edges){const mid=(edge.a+edge.b)/2,x=edge.axis==='x'?edge.line+edge.normal*.0002:mid,z=edge.axis==='z'?edge.line+edge.normal*.0002:mid;assert.equal(obstacles.some(o=>o.type==='wall'&&o.floor===floor&&Math.abs(x-o.x)<o.w/2-.00001&&Math.abs(z-o.z)<o.d/2-.00001),false);}}
});
