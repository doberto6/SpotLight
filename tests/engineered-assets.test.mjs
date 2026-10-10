import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {obstacles} from '../src/replay-engine.mjs';
import {engineeredAssetNames,equipmentAsset,equipmentPlacements} from '../src/engineered-assets.mjs';
import {legIK,footTarget,legLengths} from '../src/spot-gait.mjs';

const root=new URL('../public/models/engineered/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
test('Blender exports contain their own equipment, embedded PBR maps and bounded geometry',()=>{
  assert.deepEqual(manifest.map(m=>m.name).sort(),[...engineeredAssetNames].sort());
  assert.ok(manifest.reduce((sum,m)=>sum+m.outputBytes,0)<3*1024*1024);
  for(const entry of manifest){
    const file=fs.readFileSync(new URL(entry.output,root));
    assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(8),file.length);
    assert.equal(file.length,entry.outputBytes);
    const g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
    assert.equal(g.scenes.length,1);assert.equal(g.scenes[0].nodes.length,entry.meshes);
    assert.ok(g.nodes.every(n=>n.name.startsWith(entry.name+'_')));
    let triangles=0;
    for(const mesh of g.meshes)for(const p of mesh.primitives){
      triangles+=g.accessors[p.indices].count/3;
      assert.ok(p.attributes.NORMAL!==undefined);assert.ok(p.attributes.TEXCOORD_0!==undefined);
    }
    assert.equal(triangles,entry.triangles);assert.ok(triangles<15000);assert.ok(entry.meshes<=8);
    for(const m of g.materials){assert.ok(m.normalTexture);assert.ok(m.pbrMetallicRoughness.metallicRoughnessTexture);}
    for(const view of g.bufferViews)assert.ok((view.byteOffset||0)+view.byteLength<=g.buffers[0].byteLength);
    assert.ok(g.images.every(image=>image.bufferView!==undefined));
  }
});
test('every machinery replacement fits inside its original navigation envelope',()=>{
  for(const o of obstacles.filter(o=>o.type!=='wall')){
    const name=equipmentAsset(o),entry=manifest.find(e=>e.name===name);
    const p=equipmentPlacements(name).find(p=>p.position[0]===o.x&&p.position[2]===o.z);
    // Blender Z up -> GLB Y up; uniform fit is the same as the runtime loader.
    const [x,z,y]=entry.dimensionsBlender,dims=[x,y,z];
    const factor=Math.min(...p.size.map((n,i)=>n/dims[i]));
    assert.ok(dims[0]*factor<o.w);assert.ok(dims[2]*factor<o.d);
    assert.ok(p.position[1]+dims[1]*factor<o.h);
  }
});
test('leg IK reaches planted and lifted feet in forward and reverse trots',()=>{
  const {upper:a,lower:b}=legLengths;
  for(const direction of [-1,1])for(let i=0;i<160;i++){
    const target=footTarget(i/160*Math.PI*2,1,direction),{hip,knee}=legIK(target.x,target.y);
    const x=a*Math.sin(hip)+b*Math.sin(hip+knee),y=-a*Math.cos(hip)-b*Math.cos(hip+knee);
    assert.ok(Math.abs(x-target.x)<1e-8);assert.ok(Math.abs(y-target.y)<1e-8);
    assert.ok(target.y>=-.374);assert.ok(target.y<=-.299);
  }
  assert.deepEqual(footTarget(1,0),{x:.015,y:-.374});
});
