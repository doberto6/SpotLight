import test from 'node:test';
import assert from 'node:assert/strict';
import {rooms,obstacles,floorAt} from '../src/facility-layout.mjs';
import {wallFootprint} from '../src/facility-structure.mjs';
import {finishedWallEdges,roomDetailAnchors} from '../src/room-dressing.mjs';
import {roomFurniture} from '../src/room-furniture.mjs';
import {buildRoomFurniture} from '../src/room-furniture.js';
import {SPOT_COLLISION,blockedPose} from '../src/spot-collision.mjs';
import {stepManual} from '../src/replay-engine.mjs';

test('finished wall segmentation covers every original exposed face exactly once',()=>{
 for(const floor of ['1','2']){
  const original=wallFootprint(obstacles.filter(o=>o.type==='wall'&&o.floor===floor)),finished=finishedWallEdges(floor);
  assert.deepEqual(finished.caps,original.caps);
  for(const edge of original.edges){
   const pieces=finished.edges.filter(e=>e.axis===edge.axis&&e.line===edge.line&&e.normal===edge.normal&&e.a>=edge.a-1e-6&&e.b<=edge.b+1e-6).sort((a,b)=>a.a-b.a);
   assert.ok(pieces.length);assert.equal(pieces[0].a,edge.a);assert.equal(pieces.at(-1).b,edge.b);
   for(let i=1;i<pieces.length;i++)assert.equal(pieces[i-1].b,pieces[i].a);
   assert.ok(pieces.every(p=>p.color&&p.b>p.a));
  }
 }
});
test('all 15 rooms receive two service boards that fit exposed walls above the walking envelope',()=>{
 const anchors=roomDetailAnchors();assert.equal(anchors.length,30);
 for(const room of rooms)assert.equal(anchors.filter(a=>a.room===room.id).length,2);
 for(const p of anchors){
  const t=p.axis==='x'?p.z:p.x;
  assert.ok(t-p.width/2>=p.edge.a+.1-1e-6);assert.ok(t+p.width/2<=p.edge.b-.1+1e-6);
  assert.ok(p.baseY>SPOT_COLLISION.height);assert.ok(p.topY<=1.315);
  const bx=p.x+(p.axis==='x'?p.normal*p.depth/2:0),bz=p.z+(p.axis==='z'?p.normal*p.depth/2:0),bw=p.axis==='x'?p.depth:p.width,bd=p.axis==='x'?p.width:p.depth;
  for(const o of obstacles.filter(o=>o.type!=='wall'&&o.floor===p.floor))assert.ok(Math.abs(o.x-bx)>=(o.w+bw)/2+.024||Math.abs(o.z-bz)>=(o.d+bd)/2+.024,`${p.room} service board intersects ${o.asset}`);
 }
});
test('all furniture is registered on its room floor without intersecting existing walls or machines',()=>{
 assert.equal(roomFurniture.length,17);
 for(const r of rooms)assert.ok(roomFurniture.some(o=>o.waypoint===r.id));
 for(const o of roomFurniture){
  assert.ok(obstacles.includes(o));assert.equal(floorAt(o.x,o.z),o.floor);
  for(const signX of [-1,1])for(const signZ of [-1,1])assert.equal(floorAt(o.x+signX*o.w/2,o.z+signZ*o.d/2),o.floor);
  for(const other of obstacles.filter(p=>p!==o&&p.floor===o.floor))assert.ok(Math.abs(other.x-o.x)>=(other.w+o.w)/2-.001||Math.abs(other.z-o.z)>=(other.d+o.d)/2-.001,`${o.waypoint} intersects ${other.asset||other.type}`);
 }
});
test('furniture bodies, controls and handles fit their actual colliders and rest on the floor',()=>{
 let i=-1,furniture,feet=new Set(),parts=0;
 const bounds=(center,extent)=>{
  if(center[1]+extent[1]<.02)return; // Flat access paint is not a physical barrier.
  assert.ok(center[1]-extent[1]>=-1e-6,`${furniture.asset} below floor`);
  assert.ok(center[1]+extent[1]<=furniture.h+1e-6,`${furniture.asset} above collider`);
  assert.ok(Math.abs(center[0]-furniture.x)+extent[0]<=furniture.w/2+1e-6,`${furniture.asset} outside X collider`);
  assert.ok(Math.abs(center[2]-furniture.z)+extent[2]<=furniture.d/2+1e-6,`${furniture.asset} outside Z collider`);
  if(Math.abs(center[1]-extent[1])<1e-6)feet.add(i);parts++;
 };
 const materials=Object.fromEntries(['dark','steel','yellow','silver','blue','red'].map(k=>[k,k]));
 buildRoomFurniture({setFloor:()=>{furniture=roomFurniture[++i]},m:materials,painted:'painted',ceramic:'ceramic',amber:'amber',
  box:(s,p)=>bounds(p,s.map(v=>v/2)),
  shape:(kind,s,p,material,rotation)=>bounds(p,rotation[2]?[s[1]/2,s[0],s[2]]:[s[0],s[2],s[1]/2]),
  pipe:(a,b,r)=>{
   const delta=b.map((v,j)=>v-a[j]),length=Math.hypot(...delta);
   bounds(a.map((v,j)=>(v+b[j])/2),delta.map(v=>Math.abs(v)/2+r*Math.sqrt(Math.max(0,1-(v/length)**2))));
  }});
 assert.equal(feet.size,17);assert.ok(parts>300);
});
test('manual SPOT movement stops at the front of every new furniture collider',()=>{
 for(const o of roomFurniture){
  const depth=o.axis==='x'?o.w:o.d,offset=depth/2+SPOT_COLLISION.halfLength+.08;
  const yaw=o.axis==='x'?(o.normal>0?Math.PI:0):(o.normal>0?Math.PI/2:-Math.PI/2);
  let pose={x:o.x+(o.axis==='x'?o.normal*offset:0),z:o.z+(o.axis==='z'?o.normal*offset:0),yaw,speed:1.8};
  for(let i=0;i<40;i++){pose=stepManual(pose,{forward:1},.05,[o]);assert.equal(blockedPose(pose,[o]),false);}
  assert.ok(pose.blocked);assert.ok(Math.hypot(pose.x-o.x,pose.z-o.z)>=depth/2+SPOT_COLLISION.halfLength-.001);
 }
});
