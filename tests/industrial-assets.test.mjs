import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {industrialCredits} from '../src/industrial-credits.mjs';

const root=new URL('../public/models/industrial/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
test('all five prepared assets retain attribution and stay within the download budget',()=>{
  assert.equal(manifest.length,5);assert.equal(industrialCredits.length,5);
  assert.ok(manifest.reduce((sum,a)=>sum+a.outputBytes,0)<20*1024*1024);
  for(const asset of manifest){
    const file=fs.readFileSync(new URL(asset.output,root));assert.equal(file.length,asset.outputBytes);
    assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(4),2);assert.equal(file.readUInt32LE(8),file.length);
    const jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jsonLength).toString());
    assert.deepEqual(gltf.asset.extras,asset.sourceMetadata.extras);
    assert.ok(industrialCredits.some(c=>c.file===asset.source&&c.source===gltf.asset.extras.source));
    assert.ok(asset.triangles<25000);
  }
});
test('repacked GLB accessors reference only their own valid packed geometry',()=>{
  const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  for(const asset of manifest){
    const file=fs.readFileSync(new URL(asset.output,root)),len=file.readUInt32LE(12),g=JSON.parse(file.subarray(20,20+len).toString());
    for(const v of g.bufferViews){assert.equal(v.byteOffset%4,0);assert.ok(v.byteOffset+v.byteLength<=g.buffers[0].byteLength);}
    for(const a of g.accessors){const v=g.bufferViews[a.bufferView];assert.ok(v);assert.equal(a.byteOffset,0);assert.equal(v.byteLength,a.count*bytes[a.componentType]*components[a.type]);}
    for(const mesh of g.meshes)for(const p of mesh.primitives){assert.ok(g.accessors[p.attributes.POSITION]);assert.ok(g.materials[p.material]);}
  }
});
