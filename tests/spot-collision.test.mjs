import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {SPOT_DIMENSIONS,SPOT_COLLISION,blockedPose,clearPoseSweep,narrowRoute} from '../src/spot-collision.mjs';
import {stepManual,routeBetween,pathMetrics,pointOnPath} from '../src/replay-engine.mjs';
import {createSpot,updateSpotGait} from '../src/spot-scene.js';
import {calibrateSpot,createSpotHitbox} from '../src/spot-hitbox.js';
import {wallPanels} from '../src/industrial-details.mjs';

const doorway=width=>[{x:0,z:-(width/2+4),w:.22,d:8},{x:0,z:width/2+4,w:.22,d:8}];
test('Spot passes a 0.65 m doorway manually and automatically, but cannot pass a 0.50 m opening',()=>{
 for(const width of [.65,.5]){
  const solids=doorway(width);let pose={x:-2,z:0,yaw:0,speed:0};
  for(let i=0;i<100;i++){pose=stepManual(pose,{forward:1},.05,solids);assert.equal(blockedPose(pose,solids),false);}
  if(width===.65){assert.ok(pose.x>2);const path=routeBetween({x:-2,z:0},{x:2,z:0},solids),metrics=pathMetrics(path);assert.equal(path.at(-1).x,2);assert.ok(path.every(p=>Math.abs(p.z)<.001),'use the doorway instead of walking around the partition');
   for(let d=0;d<=metrics.length;d+=.01)assert.equal(blockedPose(pointOnPath(metrics,d),solids),false);
  }else{assert.ok(pose.x<-.11-SPOT_COLLISION.halfLength);assert.equal(clearPoseSweep({x:-2,z:0,yaw:0},{x:2,z:0,yaw:0},solids),false);}
 }
});
test('rotation checks the long body and swept corners instead of just its center',()=>{
 const corridor=[{x:0,z:-.485,w:4,d:.22},{x:0,z:.485,w:4,d:.22}];
 assert.equal(blockedPose({x:0,z:0,yaw:0},corridor),false);
 assert.equal(blockedPose({x:0,z:0,yaw:Math.PI/2},corridor),true);
 let pose={x:0,z:0,yaw:0,speed:0};for(let i=0;i<50;i++){pose=stepManual(pose,{left:1},.05,corridor);assert.equal(blockedPose(pose,corridor),false);}assert.ok(pose.yaw<.3);
 const corner=[{x:.42,z:.42,w:.07,d:.07}];
 assert.equal(blockedPose({x:0,z:0,yaw:0},corner),false);assert.equal(blockedPose({x:0,z:0,yaw:Math.PI/2},corner),false);
 assert.equal(clearPoseSweep({x:0,z:0,yaw:0},{x:0,z:0,yaw:-Math.PI/2},corner),false);
});
test('heading fallback preserves exact off-grid endpoints and includes safe turns before a narrow door',()=>{
 const solids=doorway(.65),from={x:-2.07,z:.03,yaw:Math.PI/2},to={x:2.07,z:.03,yaw:0},path=narrowRoute(from,to,solids);
 assert.deepEqual(path[0],from);assert.deepEqual(path.at(-1),to);assert.ok(path.length>3);assert.equal(path[1].x,from.x);assert.equal(path[1].z,from.z);
 for(let i=1;i<path.length;i++)assert.ok(clearPoseSweep(path[i-1],path[i],solids));
 const metrics=pathMetrics(path);for(let d=0;d<=metrics.length;d+=.01)assert.equal(blockedPose(pointOnPath(metrics,d),solids),false);
});
test('swept translation blocks thin walls and equipment; overhead fixtures stay clear',()=>{
 const from={x:-3,z:0,yaw:0},to={x:3,z:0,yaw:0};
 assert.equal(clearPoseSweep(from,to,[{x:0,z:0,w:.015,d:6}]),false);
 assert.equal(clearPoseSweep(from,to,[{x:0,z:0,w:2,d:2,h:2.5}]),false);
 assert.equal(clearPoseSweep(from,to,[{x:0,z:0,w:2,d:2,h:.6,baseY:1.65}]),true);
 assert.equal(blockedPose({x:0,z:0,yaw:0},[{x:.7,z:0,w:.3,d:.2}]),true);
});
test('hitbox dimensions and rotation share the calibrated pose; articulated feet fit through a full gait',()=>{
 const resources=[],robot=calibrateSpot(createSpot(resources)),outline=createSpotHitbox(robot,resources);
 assert.equal(outline.parent,robot);assert.equal(outline.visible,true);assert.equal(outline.material.color.getHexString(),'ffffff');assert.ok(outline.material.opacity>0&&outline.material.opacity<1);
 assert.deepEqual(outline.userData.dimensions,SPOT_COLLISION);outline.geometry.computeBoundingBox();const size=outline.geometry.boundingBox.getSize(new THREE.Vector3());
 assert.ok(Math.abs(size.x-SPOT_COLLISION.length)<1e-6);assert.ok(Math.abs(size.z-SPOT_COLLISION.width)<1e-6);
 for(const direction of [-1,1])for(let i=0;i<120;i++){
  robot.userData.gaitPhase=i/120*Math.PI*2;robot.userData.gaitBlend=1;updateSpotGait(robot,0,direction*SPOT_DIMENSIONS.maxSpeed);robot.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(robot.userData.visual);
  assert.ok(bounds.min.x>=-SPOT_COLLISION.halfLength&&bounds.max.x<=SPOT_COLLISION.halfLength);
  assert.ok(bounds.min.z>=-SPOT_COLLISION.halfWidth&&bounds.max.z<=SPOT_COLLISION.halfWidth);
  assert.ok(bounds.max.y<=SPOT_COLLISION.height&&bounds.min.y>=-.001);
 }
 robot.position.set(2,0,3);robot.rotation.y=Math.PI/3;robot.updateMatrixWorld(true);const point=outline.getWorldPosition(new THREE.Vector3());assert.equal(point.x,2);assert.equal(point.z,3);
 for(const r of new Set(resources))r.dispose();
});
test('room service panels attach to wall faces and sit above the walking volume',()=>{
 assert.equal(wallPanels.length,15);
 for(const p of wallPanels){const w=p.wall,axis=p.horizontal?'z':'x',along=p.horizontal?'x':'z',depth=(p.horizontal?w.d:w.w)/2;
  assert.ok(Math.abs(Math.abs(p[axis]-w[axis])-depth-.086)<1e-8);assert.ok(Math.abs(p[along]-w[along])+.24<=(p.horizontal?w.w:w.d)/2);assert.ok(p.y>SPOT_COLLISION.height);
 }
});
test('Blender rack and cart exports have grounded bounds and remain under 60 KB combined',()=>{
 const root=new URL('../public/models/details/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
 assert.equal(manifest.length,2);assert.ok(manifest.reduce((n,m)=>n+m.bytes,0)<60000);
 for(const m of manifest){const file=fs.readFileSync(new URL(m.name+'.glb',root));assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.length,m.bytes);
  const g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));let minY=Infinity,maxY=-Infinity;
  for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION];minY=Math.min(minY,a.min[1]);maxY=Math.max(maxY,a.max[1]);}
  assert.ok(Math.abs(minY)<1e-6);assert.ok(maxY>1&&maxY<1.6);assert.ok(m.triangles<700);
 }
});
