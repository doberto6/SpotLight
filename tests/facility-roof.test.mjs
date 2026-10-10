import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {obstacles,floors,floorAt} from '../src/facility-layout.mjs';
import {planRoof,clerestoryOpenings,deckRibs} from '../src/facility-roof.mjs';
import {wallFootprint,wallSurface} from '../src/facility-structure.mjs';
import {servicePlacements,servicePorts,headerTap} from '../src/service-connections.mjs';
import {steelSection} from '../src/steel-section.js';

test('roof supports keep their entire column foot inside existing collision walls',()=>{
 const {columns,bays}=planRoof();assert.equal(bays.length,15);
 const keys=columns.map(p=>p.floor+','+p.x+','+p.z);assert.equal(new Set(keys).size,keys.length);
 for(const p of columns)for(const dx of [-.1,.1])for(const dz of [-.1,.1])assert.ok(obstacles.some(o=>o.type==='wall'&&o.floor===p.floor&&Math.abs(p.x+dx-o.x)<=o.w/2+1e-8&&Math.abs(p.z+dz-o.z)<=o.d/2+1e-8));
 for(const bay of bays){assert.equal(new Set(bay.supports).size,4);assert.ok(bay.supports.every(p=>columns.includes(p)));assert.ok(bay.width>2);
  for(const p of bay.purlins){assert.deepEqual(p.a,bay.point(p.u,0));assert.deepEqual(p.b,bay.point(p.u,1));for(const v of [.15,.28,.72,.85]){const a=bay.point(p.u,v);assert.ok(Math.abs(Math.hypot(a.x-p.a.x,a.z-p.a.z)+Math.hypot(p.b.x-a.x,p.b.z-a.z)-Math.hypot(p.b.x-p.a.x,p.b.z-p.a.z))<1e-8);}}
 }
});

test('clerestories are physical wall openings with valid reveal normals',()=>{
 for(const floor of floors){const rects=obstacles.filter(o=>o.type==='wall'&&o.exterior&&o.floor===floor.id),holes=clerestoryOpenings(floor.id),plan=wallFootprint(rects,holes);
  assert.ok(holes.length>0);for(const h of holes)assert.equal(plan.caps.some(c=>h.x>c.x0&&h.x<c.x1&&h.z>c.z0&&h.z<c.z1),false);
  const data=wallSurface(plan,3.9,5.6,{bottom:false,top:false});for(let i=0;i<data.indices.length;i+=3){const ids=data.indices.slice(i,i+3),p=ids.map(n=>new THREE.Vector3(...data.positions.slice(n*3,n*3+3))),normal=new THREE.Vector3(...data.normals.slice(ids[0]*3,ids[0]*3+3));assert.ok(p[1].sub(p[0]).cross(p[2].sub(p[0])).dot(normal)>0);}
  for(const rib of deckRibs(floor))for(const t of [-.49,0,.49])assert.equal(floorAt(rib.x,rib.z+rib.length*t),floor.id);
 }
});

test('closed I sections contain no zero-area triangles or reversed cap faces',()=>{
 for(const rotate of [false,true]){const g=steelSection(.24,.32,.03,rotate),p=g.getAttribute('position'),n=g.getAttribute('normal');for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),normal=new THREE.Vector3().fromBufferAttribute(n,i);assert.ok(b.sub(a).cross(c.sub(a)).dot(normal)>1e-8);}g.dispose();}
});

test('service manifold export budget and fitted ports stay inside equipment foundations',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/services/manifest.json',import.meta.url))),entry=manifest[0],file=fs.readFileSync(new URL('../public/models/services/service_manifold.glb',import.meta.url));assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.length,entry.bytes);assert.ok(file.length<120000);
 const g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12))),bounds=new THREE.Box3();let triangles=0;
 for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION];bounds.expandByPoint(new THREE.Vector3(...a.min));bounds.expandByPoint(new THREE.Vector3(...a.max));triangles+=g.accessors[p.indices].count/3;assert.ok(p.attributes.NORMAL!==undefined);}
 assert.equal(triangles,entry.triangles);assert.ok(triangles<2500);assert.equal(g.materials.length,4);assert.deepEqual(entry.portsYUp,servicePorts);
 const dims=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 for(const p of servicePlacements){const scale=Math.min(...p.size.map((v,i)=>v/dims.getComponent(i))),pad=p.pad;
  assert.ok(Math.abs(p.x-pad.x)+dims.x*scale/2<pad.w/2);assert.ok(Math.abs(p.z-pad.z)+dims.z*scale/2<pad.d/2);assert.ok(.22+dims.y*scale<pad.h);
  for(const [x,y,z] of servicePorts){assert.ok(Math.abs(p.x+(x-center.x)*scale-pad.x)<pad.w/2);assert.ok(Math.abs(p.z+(z-center.z)*scale-pad.z)<pad.d/2);assert.ok(y>bounds.min.y);}
  const bay=planRoof().bays.find(b=>b.id===pad.waypoint),tap=headerTap(bay,p),a=bay.point(.04,.15),b=bay.point(.96,.15);assert.ok(Math.abs(Math.hypot(tap.x-a.x,tap.z-a.z)+Math.hypot(b.x-tap.x,b.z-tap.z)-Math.hypot(b.x-a.x,b.z-a.z))<1e-8);
 }
});
