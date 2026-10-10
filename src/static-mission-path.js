import * as THREE from 'three';
import {dottedPath} from './replay-engine.mjs';
import {waypointFloor} from './facility-layout.mjs';

// The recorded route is the sole input. Live position, progress and playback
// clocks never reach this builder or its instance buffers.
export function createStaticMissionPath(scene,resources,recorded){
  const geometry=new THREE.CircleGeometry(.085,10),material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),meshes=[];
  resources.push(geometry,material);
  const dots={1:new Map(),2:new Map()};
  recorded.segments.forEach((s,i)=>{if(s.transfer||s.unreachable)return;const floor=waypointFloor(recorded.nodes[i].location_id);for(const p of dottedPath(s))dots[floor].set(p.x.toFixed(4)+','+p.z.toFixed(4),p);});
  const dummy=new THREE.Object3D();dummy.rotation.x=-Math.PI/2;
  for(const floor of ['1','2']){const points=[...dots[floor].values()],mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,points.length));mesh.count=points.length;mesh.name='Static mission route · floor '+floor;mesh.userData.floor=floor;for(const [i,p] of points.entries()){dummy.position.set(p.x,.035,p.z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);resources.push(mesh);meshes.push(mesh);}
  const hash=array=>{let value=2166136261;const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(const b of bytes)value=Math.imul(value^b,16777619);return (value>>>0).toString(16);};
  return {setVisible:(floor,show=true)=>{for(const mesh of meshes)mesh.visible=show&&(floor==='all'||floor===mesh.userData.floor);},snapshot:()=>meshes.map(mesh=>({floor:mesh.userData.floor,id:mesh.uuid,count:mesh.count,version:mesh.instanceMatrix.version,hash:hash(mesh.instanceMatrix.array),color:material.color.getHexString(),opacity:material.opacity,visible:mesh.visible})),meshes};
}
