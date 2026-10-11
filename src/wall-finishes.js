import * as THREE from 'three';
import {finishedWallEdges,wallPalette} from './room-dressing.mjs';
import {wallSurface} from './facility-structure.mjs';
import {paintedWallMaps} from './plant-surfaces.js';

export function wallFinishMaterials(resources){
 const maps=paintedWallMaps(resources),paint={};
 for(const color of new Set(Object.values(wallPalette))){
  const material=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.12,...maps});
  // Restrained darkening at the lower edge, rather than a uniformly dirty room.
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying float wallHeight;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n wallHeight=(modelMatrix*vec4(transformed,1.0)).y;');
   shader.fragmentShader='varying float wallHeight;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb*=mix(.88,1.0,smoothstep(.14,.36,wallHeight));');
  };
  material.customProgramCacheKey=()=> 'maintained-painted-dado';resources.push(material);paint[color]=material;
 }
 return paint;
}

export function buildWallFinish({floor,resources,groups,upper,box,m,paint}){
 const plan=finishedWallEdges(floor),keep=r=>(resources.push(r),r);
 const surface=(part,lo,hi,material,options)=>{
  const data=wallSurface(part,lo,hi,options),geo=keep(new THREE.BufferGeometry());
  geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geo.setIndex(data.indices);
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=mesh.castShadow=true;groups[floor].add(mesh);
 };
 // Bands replace the old lower wall mesh. The union cap has only one surface;
 // none of these finishes adds thickness to the collision footprint.
 surface(plan,-.035,.14,m.dark,{bottom:true,top:false});
 for(const [color,material] of Object.entries(paint)){const edges=plan.edges.filter(e=>e.color===color);if(edges.length)surface({edges,caps:[]},.14,.805,material,{bottom:false,top:false});}
 surface(plan,.805,.845,m.frame,{bottom:false,top:false});
 surface(plan,.845,1.315,m.wall,{bottom:false,top:false});
 surface(plan,1.315,1.35,m.steel,{bottom:false,top:true});
 for(const e of plan.trimEdges){
  const size=(length,height,depth)=>e.axis==='x'?[depth,height,length]:[length,height,depth];
  const point=(t,y,depth=.004)=>e.axis==='x'?[e.line+e.normal*depth,y,t]:[t,y,e.line+e.normal*depth];
  // Slim flush skirting, panel dividers, bolted reinforcement and steel caps
  // all project <= 8 mm, within the existing 25 mm walking clearance.
  for(const y of [.13,.825])box(size(e.b-e.a,.025,.006),point((e.a+e.b)/2,y),m.silver);
  const count=Math.max(1,Math.ceil((e.b-e.a)/2.4));
  for(let i=0;i<=count;i++){
   const t=e.a+(e.b-e.a)*i/count;
   box(size(.026,1.175,.006),point(t,.7275),m.frame);
   for(const y of [.22,.74,1.24])box(size(.008,.008,.004),point(t,y,.006),m.silver);
   box(size(.013,2.13,.006),point(t,2.425),m.joint,upper);
  }
  // Upper-wall architectural panel joints align with the lower segmentation.
  box(size(e.b-e.a,.012,.003),point((e.a+e.b)/2,2.42,.002),m.joint,upper);
 }
 return plan.edges.length;
}
