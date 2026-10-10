import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {obstacles,bounds,worldPoint} from './replay-engine.mjs';

export const industrialAssetNames=['factory_modular_kit','industrial_electrical_box','industrial_factory_with_towers_and_pipes','industrial_pipes_pack','large_modular_pipes_metal'];

export function createReplayEnvironment(scene,resources,locations,onAssets=()=>{}) {
  let disposed=false;const solids=[],geometryCache=new Map(),batches=new Map();
  const keep=r=>{resources.push(r);return r;};
  const material=(color,roughness=.65,metalness=.25,extra={})=>keep(new THREE.MeshStandardMaterial({color,roughness,metalness,...extra}));
  const m={steel:material('#445968',.35,.8),silver:material('#a0adb4',.3,.8),blue:material('#397680',.5,.55),green:material('#597666',.6,.4),yellow:material('#d4a63d',.5,.35),dark:material('#20313e'),wall:material('#b3b6ad',.95,.02),red:material('#ab4a3e',.5,.45),black:material('#222c34'),glass:material('#89b8bd',.18,.25,{transparent:true,opacity:.24,depthWrite:false}),light:material('#d5edee',.4,.1,{emissive:'#a5e8eb',emissiveIntensity:1.1}),status:material('#7adac9',.3,.2,{emissive:'#4fd2b6',emissiveIntensity:1.5})};
  function geo(kind){if(!geometryCache.has(kind))geometryCache.set(kind,keep(kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='cylinder'?new THREE.CylinderGeometry(1,1,1,20):kind==='sphere'?new THREE.SphereGeometry(1,16,10):new THREE.TorusGeometry(1,.12,8,24)));return geometryCache.get(kind);}
  function batch(kind,mat,matrix){const key=kind+':'+mat.uuid;if(!batches.has(key))batches.set(key,{geometry:geo(kind),material:mat,matrices:[]});batches.get(key).matrices.push(matrix.clone());}
  // Repeated procedural details share geometry/material and become GPU instances.
  function shape(kind,size,pos,mat,rotation=[0,0,0],collision=false){
    const mesh=new THREE.Mesh(geo(kind),mat);mesh.position.set(...pos);mesh.scale.set(...size);mesh.rotation.set(...rotation);mesh.updateMatrix();
    if(collision){mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);solids.push(mesh);return mesh;}
    batch(kind,mat,mesh.matrix);return mesh;
  }
  const box=(size,pos,mat,collision=false)=>shape('box',size,pos,mat,[0,0,0],collision);
  const cyl=(r,h,pos,mat,rotation=[0,0,0])=>shape('cylinder',[r,h,r],pos,mat,rotation);
  const pipe=(a,b,r,mat=m.silver)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start),mesh=new THREE.Mesh(geo('cylinder'),mat);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.clone().normalize());mesh.scale.set(r,axis.length(),r);mesh.updateMatrix();batch('cylinder',mat,mesh.matrix);};
  function sign(text,x,y,z,width=3,color='#d6ac4d',yaw=0){
    const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#152a36';ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.fillRect(0,0,10,128);ctx.fillStyle='#edf5ed';ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.fillText(text,260,77,470);
    const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;const material=keep(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));const plane=keep(new THREE.PlaneGeometry(width,width/4)),mesh=new THREE.Mesh(plane,material);mesh.position.set(x,y,z);mesh.rotation.y=yaw;scene.add(mesh);
  }
  function concreteTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');let seed=713;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=143+(seed%19);ctx.fillStyle='rgb('+v+','+(v+3)+','+(v+1)+')';ctx.fillRect(x,y,1,1);}
    ctx.strokeStyle='#737f7d';ctx.lineWidth=1;ctx.strokeRect(0,0,256,256);const texture=keep(new THREE.CanvasTexture(c));texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(20,12);texture.anisotropy=4;return texture;
  }
  const concrete=material('#99a6a7',.94,.03,{map:concreteTexture()});
  const floor=new THREE.Mesh(keep(new THREE.BoxGeometry(80,.2,45)),concrete);floor.position.y=-.1;floor.receiveShadow=true;scene.add(floor);
  // Operator pathways and bay boundaries replace the floor-plan poster on the ground.
  const marking=material('#d8c27c',.8,.05),path=material('#628f88',.9,.05);
  box([78,.012,2.7],[0,.012,0],path);
  for(const z of [-1.5,1.5])box([78,.013,.09],[0,.017,z],marking);
  for(const x of [-20,15]){box([2.4,.012,43],[x,.013,0],path);for(const side of [-1.3,1.3])box([.08,.013,43],[x+side,.019,0],marking);}
  for(let x=-38;x<39;x+=4){box([1,.014,.12],[x,.018,-2],marking);box([1,.014,.12],[x,.018,2],marking);}
  function wall(x,z,w,d,h=3.5){
    box([w,1.1,d],[x,.55,z],m.wall,true);box([w,.45,d],[x,h-.225,z],m.steel,true);
    box([w,1.95,d*.4],[x,2.075,z],m.glass);
    const count=Math.max(1,Math.round(Math.max(w,d)/2.5));for(let i=0;i<=count;i++){const f=i/count-.5;box([w>d?.07:w,2,d>w?.07:d],[x+(w>d?w*f:0),2.05,z+(d>w?d*f:0)],m.steel);}
    box([w,.12,d+.04],[x,1.12,z],m.steel);box([w,.07,d+.02],[x,.12,z],m.dark);
  }
  const cabinetPlacements=[];
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const shadowCtx=shadowCanvas.getContext('2d'),gradient=shadowCtx.createRadialGradient(32,32,7,32,32,32);gradient.addColorStop(0,'#00000070');gradient.addColorStop(1,'#00000000');shadowCtx.fillStyle=gradient;shadowCtx.fillRect(0,0,64,64);
  const shadowMaterial=keep(new THREE.MeshBasicMaterial({map:keep(new THREE.CanvasTexture(shadowCanvas)),transparent:true,depthWrite:false})),shadowGeometry=keep(new THREE.PlaneGeometry(1,1));
  for(const o of obstacles){
    if(o.type==='wall'){wall(o.x,o.z,o.w,o.d,o.h);continue;}
    // Original collision volumes define footprints for every equipment bay.
    const proxy=new THREE.Mesh(geo('box'),m.dark);proxy.position.set(o.x,o.h/2,o.z);proxy.scale.set(o.w,o.h,o.d);proxy.visible=false;scene.add(proxy);solids.push(proxy);
    const contact=new THREE.Mesh(shadowGeometry,shadowMaterial);contact.rotation.x=-Math.PI/2;contact.scale.set(o.w+2,o.d+2,1);contact.position.set(o.x,.009,o.z);scene.add(contact);
    box([o.w+.1,.16,o.d+.1],[o.x,.08,o.z],m.dark);
    for(const side of [-1,1])box([o.w,.015,.06],[o.x,.015,o.z+side*(o.d/2+.08)],marking);
    if(o.type==='generator'){
      cyl(.83,2.8,[o.x,1.1,o.z],m.blue,[Math.PI/2,0,0]);cyl(.92,.15,[o.x,1.1,o.z-1.3],m.silver,[Math.PI/2,0,0]);
      for(let i=0;i<7;i++)cyl(.85,.05,[o.x,1.1,o.z-1+i*.34],m.steel,[Math.PI/2,0,0]);
      box([1.5,.5,1],[o.x,1.7,o.z],m.blue);box([1.4,.07,3.1],[o.x,.28,o.z],m.green);
      for(const dx of [-.55,.55])box([.2,.45,2.5],[o.x+dx,.35,o.z],m.steel);
      sign('TURBINE / GEN-'+(o.x<0?'01':'02'),o.x,2.2,o.z+1.9,2.5);
    }else if(o.x< -20){
      cyl(.83,1.7,[o.x,1.25,o.z],m.silver);shape('sphere',[.83,.32,.83],[o.x,2.1,o.z],m.silver);shape('sphere',[.83,.32,.83],[o.x,.4,o.z],m.silver);
      pipe([o.x,2.25,o.z],[o.x+.9,2.25,o.z],.13);pipe([o.x+.9,2.25,o.z],[o.x+.9,.65,o.z],.13);cyl(.22,.07,[o.x+.9,1.3,o.z],m.red);
      sign('BOILER / VESSEL',o.x,2.6,o.z+1.22,2.8);
    }else if(o.x<0){
      for(const dx of [-.65,.65]){
        cyl(.3,1.2,[o.x+dx,.55,o.z],m.blue,[Math.PI/2,0,0]);cyl(.4,.4,[o.x+dx,.52,o.z+.75],m.green,[Math.PI/2,0,0]);
        for(let i=0;i<6;i++)cyl(.33,.04,[o.x+dx,.55,o.z-.45+i*.15],m.steel,[Math.PI/2,0,0]);
        pipe([o.x+dx,.7,o.z+.8],[o.x+dx,1.8,o.z+.8],.12);shape('torus',[.2,.2,.2],[o.x+dx,1.45,o.z+.8],m.red,[Math.PI/2,0,0]);
      }
      sign('COOLING / PUMPS',o.x,2.2,o.z+1.22,2.8);
    }else if(o.x<10){
      cabinetPlacements.push([o.x-.62,0,o.z],[o.x+.62,0,o.z]);
      for(const dx of [-.66,.66]){box([1.2,2.2,1.3],[o.x+dx,1.15,o.z],m.green);box([1,.95,.035],[o.x+dx,1.6,o.z+.67],m.dark);box([.45,.32,.035],[o.x+dx,1.7,o.z+.7],m.status);for(let i=0;i<3;i++)box([.8,.07,.04],[o.x+dx,.55+i*.15,o.z+.67],m.black);}
      sign('SWITCHGEAR / HV',o.x,2.6,o.z+1.22,2.8);
    }else{
      box([1.8,1.5,1.5],[o.x,.9,o.z],m.green);
      for(const dx of [-.8,.8])for(let i=0;i<7;i++)box([.15,1.45,.07],[o.x+dx,.9,o.z-.6+i*.2],m.silver);
      for(const dx of [-.6,0,.6]){cyl(.1,.65,[o.x+dx,1.95,o.z],m.wall);for(let i=0;i<4;i++)cyl(.18,.04,[o.x+dx,1.7+i*.12,o.z],m.wall);}
      sign('TRANSFORMER / TX',o.x,2.65,o.z+1.22,2.8);
    }
  }
  for(const z of [bounds.minZ,bounds.maxZ])wall(0,z,80,.3,4.2);
  for(const x of [bounds.minX,bounds.maxX])wall(x,0,.3,45,4.2);
  // Overhead runs connect bays without obstructing the robot's travel space.
  for(const z of [-16,16]){
    for(const [y,r,mat] of [[3.7,.16,m.silver],[4.2,.22,m.blue],[4.65,.1,m.yellow]]){
      pipe([-38,y,z],[38,y,z],r,mat);
      for(let x=-36;x<=36;x+=8)cyl(r*1.6,.09,[x,y,z],m.steel,[0,0,Math.PI/2]);
    }
    for(let x=-36;x<=36;x+=8){box([.13,1.7,.13],[x,4.25,z+1.8],m.steel);box([.15,.15,4],[x,4.95,z],m.steel);}
    box([77,.22,.7],[0,4.9,z-2],m.dark);for(let x=-37;x<38;x+=2)box([.08,.28,.8],[x,4.9,z-2],m.silver);
    box([76,.65,.8],[0,5.5,z+3],m.silver);for(let x=-36;x<38;x+=4)box([.06,.7,.9],[x,5.5,z+3],m.steel);
  }
  for(let x=-35;x<=35;x+=10){
    box([.16,2,.16],[x,5.7,-21],m.steel);box([.16,2,.16],[x,5.7,21],m.steel);box([.15,.25,42],[x,6.8,0],m.steel);
    for(const z of [-6,6]){box([2,.13,.45],[x,6.5,z],m.dark);box([1.8,.04,.3],[x,6.41,z],m.light);}
  }
  // Maintenance access stays over equipment footprints, away from mission routes.
  box([2.8,.12,2.2],[-28,2.8,16],m.steel);for(let x=-29.3;x<=-26.7;x+=.65)pipe([x,2.8,17],[x,3.8,17],.035,m.yellow);pipe([-29.3,3.8,17],[-26.7,3.8,17],.035,m.yellow);
  for(const dx of [-.3,.3])pipe([-28+dx,.1,17.1],[-28+dx,3,17.1],.035,m.silver);for(let y=.3;y<3;y+=.3)pipe([-28.3,y,17.1],[-27.7,y,17.1],.025,m.silver);
  sign('01 / TURBINE HALL',-34,3.1,9.78,5);sign('02 / COOLING & MECHANICAL',-11,3.1,-9.78,6,'#69d3ca',Math.PI);sign('03 / ELECTRICAL CONTROL',6,3.1,9.78,6);sign('04 / TRANSFORMER BAY',28,3.1,-9.78,5,'#69d3ca',Math.PI);
  sign('HIGH VOLTAGE / AUTHORIZED ACCESS',14.55,2.65,6,4,'#f2c261',Math.PI/2);
  // The extracted exterior shell has gaps where high-density source meshes were
  // omitted. A cohesive boiler-house volume and stacks complete that silhouette.
  box([11,7.5,22],[-56,3.75,0],m.wall);box([11.4,.3,22.4],[-56,7.65,0],m.steel);
  for(const z of [-8,8]){
    cyl(1.2,17,[-56,8.5,z],m.silver);cyl(1.38,.3,[-56,17,z],m.dark);
    pipe([-50,4,z],[-45,4,z],.4,m.silver);pipe([-45,4,z],[-45,6.5,z],.4,m.silver);
  }
  sign('GENERATION / BOILER HOUSE',-50.4,5.5,0,7,'#d6ac4d',Math.PI/2);
  for(const loc of locations){const p=worldPoint(loc.location_id);const ring=new THREE.Mesh(keep(new THREE.RingGeometry(.42,.48,32)),keep(new THREE.MeshBasicMaterial({color:'#4eaea5',transparent:true,opacity:.7,side:THREE.DoubleSide})));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.021,p.z);scene.add(ring);}
  for(const {geometry,material,matrices} of batches.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);keep(mesh);}

  function disposeModel(root){const items=[];root.traverse(o=>{if(o.geometry)items.push(o.geometry);for(const mat of [].concat(o.material||[])){items.push(mat);for(const v of Object.values(mat))if(v?.isTexture)items.push(v);}});for(const r of new Set(items))r.dispose();}
  function registerModel(root){root.traverse(o=>{if(o.geometry)keep(o.geometry);if(o.material)for(const mat of [].concat(o.material)){keep(mat);for(const value of Object.values(mat))if(value?.isTexture)keep(value);}});}
  function instantiate(root,targetSize,positions,rotation=[0,0,0],castShadow=false){
    const template=new THREE.Group(),item=root.clone(true);template.add(item);item.rotation.set(...rotation);template.updateMatrixWorld(true);
    const bound=new THREE.Box3().setFromObject(template),size=bound.getSize(new THREE.Vector3()),center=bound.getCenter(new THREE.Vector3());
    const factor=Math.min(...targetSize.map((n,i)=>n/Math.max(size.getComponent(i),.001)));template.scale.setScalar(factor);item.position.sub(new THREE.Vector3(center.x,bound.min.y,center.z));template.updateMatrixWorld(true);
    template.traverse(child=>{if(!child.isMesh)return;const instance=new THREE.InstancedMesh(child.geometry,child.material,positions.length);positions.forEach((p,i)=>{const transform=new THREE.Matrix4().makeTranslation(...p);instance.setMatrixAt(i,transform.multiply(child.matrixWorld));});instance.castShadow=castShadow;instance.receiveShadow=true;instance.computeBoundingSphere();scene.add(instance);keep(instance);});
  }
  function mesh(root,fragment){let match;root.traverse(o=>{if(o.isMesh&&o.name.includes(fragment))match=o;});return match;}
  const loader=new GLTFLoader();let count=0;onAssets({loaded:0,total:industrialAssetNames.length,failed:[]});const failed=[];
  const jobs=industrialAssetNames.map(async name=>{
    try{
      const gltf=await loader.loadAsync('/models/industrial/'+name+'.glb');
      if(disposed){disposeModel(gltf.scene);return;}
      registerModel(gltf.scene);
      if(name==='industrial_electrical_box')instantiate(gltf.scene,[1.05,1.6,1],cabinetPlacements.map(p=>[p[0],.25,p[2]+.22]));
      if(name==='factory_modular_kit'){
        const column=mesh(gltf.scene,'_11_'),beam=mesh(gltf.scene,'_14_'),access=mesh(gltf.scene,'_35_');
        if(column)instantiate(column,[.9,5.5,.9],[-30,-10,10,30].flatMap(x=>[-23,23].map(z=>[x,0,z])),[0,0,0],true);
        if(beam)instantiate(beam,[.6,.6,3.5],[-30,-10,10,30].flatMap(x=>[-19,-15,-11,-7,-3,1,5,9,13,17].map(z=>[x,5.8,z])));
        if(access)instantiate(access,[2.7,2.5,2],[[4,.2,-16],[26,.2,16]]);
      }
      if(name==='large_modular_pipes_metal'){
        const valve=mesh(gltf.scene,'BigValve'),elbow=mesh(gltf.scene,'RoundElbow'),clamp=mesh(gltf.scene,'Clamp'),small=mesh(gltf.scene,'SmallValve'),straight=mesh(gltf.scene,'Straight4'),connector=mesh(gltf.scene,'WallConnector');
        if(valve)instantiate(valve,[.75,.6,.75],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,3.55,z])));
        if(elbow)instantiate(elbow,[1.3,1.3,1.3],[[-37,3.5,-16],[37,3.5,16]]);
        if(clamp)instantiate(clamp,[.6,.5,.6],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,4.1,z])));
        if(small)instantiate(small,[.55,.4,.55],[[-12,1.4,-15.2],[-12,1.4,16.8]]);
        if(straight)instantiate(straight,[3,.6,.6],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,4,z])),[0,0,Math.PI/2]);
        if(connector)instantiate(connector,[.6,.4,.6],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,3.8,z])));
      }
      if(name==='industrial_pipes_pack'){
        const junction=mesh(gltf.scene,'Cylinder_011')||mesh(gltf.scene,'Cylinder.011'),wheel=mesh(gltf.scene,'Torus'),straight=mesh(gltf.scene,'Cylinder_036')||mesh(gltf.scene,'Cylinder.036');
        if(junction)instantiate(junction,[.8,.8,.8],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,3.5,z])));
        if(wheel)instantiate(wheel,[.5,.5,.2],[[-12,1.6,-15.1],[-12,1.6,16.9],[4,1.6,16.9]]);
        if(straight)instantiate(straight,[3.5,.65,.65],[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>[x,3.5,z])),[0,Math.PI/2,0]);
      }
      // Only the low-poly shell from the merged factory goes in the external yard.
      if(name==='industrial_factory_with_towers_and_pipes'){
        const lod=new THREE.LOD(),shell=gltf.scene.clone(true),b=new THREE.Box3().setFromObject(shell),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
        const scale=28/Math.max(s.x,s.y,s.z);shell.scale.setScalar(scale);shell.position.set(-c.x*scale,-b.min.y*scale,-c.z*scale);lod.addLevel(shell,0);lod.addLevel(new THREE.Group(),85);lod.position.set(-56,0,0);scene.add(lod);
      }
    }catch(e){failed.push(name);console.warn('Industrial component unavailable:',name,e.message);}
    finally{if(!disposed)onAssets({loaded:++count,total:industrialAssetNames.length,failed:[...failed]});}
  });
  return {solids,floor,ready:Promise.all(jobs),dispose:()=>{disposed=true;}};
}
