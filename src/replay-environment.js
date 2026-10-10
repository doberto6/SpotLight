import * as THREE from 'three';
import {obstacles,bounds,worldPoint} from './replay-engine.mjs';

export function createReplayEnvironment(scene,resources,locations) {
  const solids=[];
  const box=(w,h,d,x,y,z,color)=>{
    const geometry=new THREE.BoxGeometry(w,h,d),material=new THREE.MeshStandardMaterial({color,roughness:.75,metalness:.15});resources.push(geometry,material);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  };
  const floor=box(80,.25,45,0,-.15,0,'#354651');
  const texture=new THREE.TextureLoader().load('/kit-assets/fictional_floor_plan.png');texture.colorSpace=THREE.SRGBColorSpace;resources.push(texture);
  const geo=new THREE.PlaneGeometry(80,45),mat=new THREE.MeshStandardMaterial({map:texture,color:'#9aaebd',roughness:1});resources.push(geo,mat);
  const plan=new THREE.Mesh(geo,mat);plan.rotation.x=-Math.PI/2;plan.position.y=-.015;plan.receiveShadow=true;scene.add(plan);
  for(const o of obstacles){
    const mesh=box(o.w,o.h,o.d,o.x,o.h/2,o.z,o.type==='wall'?'#697e90':'#344958');solids.push(mesh);
    if(o.type==='cabinet'){
      box(o.w*.8,.04,.03,o.x,1.8,o.z+o.d/2+.02,'#7eced4');
      for(let i=0;i<3;i++)box(o.w*.75,.1,.035,o.x,.5+i*.28,o.z+o.d/2+.04,'#182b3a');
    }
    if(o.type==='generator'){
      box(o.w+.4,.2,o.d+.4,o.x,.1,o.z,'#d6a644');
      for(let i=0;i<4;i++)box(.08,1.5,o.d*.8,o.x-o.w/2+.4+i*.5,1.4,o.z,'#96a9b5');
    }
  }
  for(const z of [bounds.minZ,bounds.maxZ])solids.push(box(80,3.5,.3,0,1.75,z,'#5b7285'));
  for(const x of [bounds.minX,bounds.maxX])solids.push(box(.3,3.5,45,x,1.75,0,'#5b7285'));
  // Overhead pipes remain outside the robot's traversable height.
  for(const z of [-19,19]){
    const geometry=new THREE.CylinderGeometry(.16,.16,77,16),material=new THREE.MeshStandardMaterial({color:'#a9b4bf',metalness:.75,roughness:.3});resources.push(geometry,material);
    const pipe=new THREE.Mesh(geometry,material);pipe.rotation.z=Math.PI/2;pipe.position.set(0,4.5,z);scene.add(pipe);
  }
  for(const l of locations){
    const p=worldPoint(l.location_id);box(.08,.05,1,p.x,.03,p.z,'#6b899a');
  }
  return {solids,floor};
}
