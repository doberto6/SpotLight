import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {obstacles,floors,rooms,imageToWorld,equipment} from './facility-layout.mjs';
import {engineeredAssetNames} from './engineered-assets.mjs';
import {concreteMaps,industrialFloorMaps} from './plant-surfaces.js';
import {wallFootprint,wallSurface} from './facility-structure.mjs';
import {planRoof,clerestoryOpenings,deckRibs} from './facility-roof.mjs';
import {steelSection} from './steel-section.js';
import {servicePlacements,servicePorts,headerTap} from './service-connections.mjs';
import {wallPanels} from './industrial-details.mjs';
import {buildPlantFitout} from './plant-fitout.js';
import {wallFinishMaterials,buildWallFinish} from './wall-finishes.js';
import {buildRoomDressing} from './room-dressing.js';
export const fitoutAssetNames=['maintenance_workbench','bridge_hoist'];
export const industrialAssetNames=['factory_modular_kit','industrial_electrical_box','industrial_pipes_pack','large_modular_pipes_metal'];

export function createReplayEnvironment(scene,resources,locations,onAssets=()=>{}){
  let disposed=false,currentFloor='1';const groups={1:new THREE.Group(),2:new THREE.Group()},solids=[],batches=new Map(),fallbacks=new Map(),rackFallbacks=[],fitoutPlacements={maintenance_workbench:[],bridge_hoist:[]},detailPlacements={pipe_rack:[],maintenance_cart:[]},upperWalls=[],wallMounts={},decks=[],roofGroups={},structuralPlacements={roof_truss:[],industrial_luminaire:[],pipe_hanger:[]},roofPlan=planRoof();Object.entries(groups).forEach(([id,g])=>{g.name='Floor '+id;scene.add(g);roofGroups[id]=new THREE.Group();g.add(roofGroups[id]);});
  const keep=r=>(resources.push(r),r),mat=(color,roughness=.65,metalness=.4,extra={})=>keep(new THREE.MeshStandardMaterial({color,roughness,metalness,...extra}));
  const m={steel:mat('#4f626b',.4,.8),silver:mat('#a1b1b7',.32,.85),blue:mat('#397e87',.48,.55),yellow:mat('#caaa47',.6,.35),dark:mat('#303a40'),wall:mat('#d5d5c8',.89,.02,concreteMaps(resources,[.55,.55],{joints:false,base:190,normalStrength:.15})),frame:mat('#8d9995',.58,.55),red:mat('#a54d3c'),light:mat('#eef5ec',.4,.1,{emissive:'#dbe9e4',emissiveIntensity:1.2}),floor:mat('#c9d5db',.89,.01,industrialFloorMaps(resources)),glass:mat('#b1cecc',.24,.1,{transparent:true,opacity:.3,depthWrite:false})};
  m.joint=mat('#737873',.95,0);m.cargo=mat('#8b7754',.9,0);const wallPaint=wallFinishMaterials(resources);
  // Retain photographed wear while reducing the outdoor brown cast indoors.
  m.floor.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,.18);');};
  m.floor.customProgramCacheKey=()=> 'industrial-concrete-desaturated';
  const geos={column:keep(steelSection()),beam:keep(steelSection(.24,.32,.03,true).translate(0,-.5,0)),box:keep(new THREE.BoxGeometry(1,1,1)),cylinder:keep(new THREE.CylinderGeometry(1,1,1,20)),sphere:keep(new THREE.SphereGeometry(1,16,10)),torus:keep(new THREE.TorusGeometry(1,.1,8,20))};
  const add=o=>{groups[currentFloor].add(o);return o;};
  function shape(kind,size,pos,material,rotation=[0,0,0],parent=null){const mesh=new THREE.Mesh(geos[kind],material);mesh.position.set(...pos);mesh.scale.set(...size);mesh.rotation.set(...rotation);mesh.updateMatrix();const k=currentFloor+kind+material.uuid+(parent?.uuid||'');if(!batches.has(k))batches.set(k,{kind,material,floor:currentFloor,parent,matrices:[]});batches.get(k).matrices.push(mesh.matrix.clone());return mesh;}
  const box=(size,pos,material,parent)=>shape('box',size,pos,material,[0,0,0],parent);
  const pipe=(a,b,r=.1,material=m.silver,parent=null)=>{const v=new THREE.Vector3(...a),q=new THREE.Vector3(...b),axis=q.clone().sub(v),mesh=new THREE.Mesh(geos.cylinder,material);mesh.position.copy(v.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.clone().normalize());mesh.scale.set(r,axis.length(),r);mesh.updateMatrix();const k=currentFloor+'pipe'+material.uuid+(parent?.uuid||'');if(!batches.has(k))batches.set(k,{kind:'cylinder',material,floor:currentFloor,parent,matrices:[]});batches.get(k).matrices.push(mesh.matrix.clone());};
  const beamKeys=new Set(),trussKeys=new Set();
  const spanKey=(a,b,y)=>currentFloor+'|'+y+'|'+[a,b].map(p=>p.x.toFixed(4)+','+p.z.toFixed(4)).sort().join('|');
  const beam=(a,b,y,parent)=>{const keySpan=spanKey(a,b,y);if(beamKeys.has(keySpan))return;beamKeys.add(keySpan);const start=new THREE.Vector3(a.x,y,a.z),end=new THREE.Vector3(b.x,y,b.z),delta=end.clone().sub(start);if(delta.length()<.01)return;const mesh=new THREE.Mesh(geos.beam,m.frame);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),delta.clone().normalize(),new THREE.Vector3(0,1,0).cross(delta.clone().normalize())));mesh.scale.y=delta.length();mesh.updateMatrix();const key=currentFloor+'beam'+parent.uuid;if(!batches.has(key))batches.set(key,{kind:'beam',material:m.frame,floor:currentFloor,parent,matrices:[]});batches.get(key).matrices.push(mesh.matrix.clone());};
  const roundedPipe=(points,r,material)=>{
    const vectors=points.map(p=>new THREE.Vector3(...p)),curve=new THREE.CurvePath();let from=vectors[0];
    for(let i=1;i<vectors.length-1;i++){const p=vectors[i],before=vectors[i-1],after=vectors[i+1],radius=Math.min(.25,p.distanceTo(before)*.25,p.distanceTo(after)*.25),entry=p.clone().add(before.clone().sub(p).normalize().multiplyScalar(radius)),exit=p.clone().add(after.clone().sub(p).normalize().multiplyScalar(radius));
      if(from.distanceTo(entry)>.001)curve.add(new THREE.LineCurve3(from,entry));curve.add(new THREE.QuadraticBezierCurve3(entry,p,exit));from=exit;
    }
    if(from.distanceTo(vectors.at(-1))>.001)curve.add(new THREE.LineCurve3(from,vectors.at(-1)));
    const geo=keep(new THREE.TubeGeometry(curve,Math.max(16,Math.ceil(curve.getLength()*2)),r,10,false)),mesh=new THREE.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;add(mesh);
  };
  for(const f of floors){currentFloor=f.id;const outline=new THREE.Shape(f.outline.map(p=>{const q=imageToWorld(p);return new THREE.Vector2(q.x,-q.z);}));const geo=keep(new THREE.ExtrudeGeometry(outline,{depth:.2,bevelEnabled:false})),floor=add(new THREE.Mesh(geo,m.floor));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.2;
    const wallRects=obstacles.filter(o=>o.type==='wall'&&o.floor===f.id),footprint=wallFootprint(wallRects),outside=wallRects.filter(o=>o.exterior),openings=clerestoryOpenings(f.id),outerFootprint=wallFootprint(outside),windowBand=wallFootprint(outside,openings);
    const buildWall=(plan,low,high,options,parent=groups[f.id])=>{const data=wallSurface(plan,low,high,options),g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));g.setIndex(data.indices);const mesh=new THREE.Mesh(g,m.wall);parent.add(mesh);mesh.castShadow=mesh.receiveShadow=true;return mesh;};
    // Flush expansion joints, clipped to the actual irregular floor outline.
    for(const rib of deckRibs(f,4))box([.012,.003,rib.length],[rib.x,.0015,rib.z],m.joint);
    const transposed={outline:f.outline.map(p=>{const q=imageToWorld(p);return [(q.z/.8)+50,(q.x/.45)+50];})};
    for(const rib of deckRibs(transposed,4))box([rib.length,.003,.012],[rib.z,.0015,rib.x],m.joint);
    const upper=new THREE.Group();add(upper);upperWalls.push(upper);wallMounts[f.id]=upper;
    buildWallFinish({floor:f.id,resources,groups,upper,box,shape,m,paint:wallPaint});
    buildWall(footprint,1.35,3.5,{bottom:false,top:true},upper);
    buildWall(outerFootprint,3.5,3.9,{bottom:false,top:true},upper);
    buildWall(windowBand,3.9,5.6,{bottom:false,top:false},upper);
    buildWall(outerFootprint,5.6,7.4,{bottom:true,top:true},upper);
    for(const w of openings){const width=w.horizontal?w.w:w.d;box(w.horizontal?[width-.06,1.64,.024]:[.024,1.64,width-.06],[w.x,4.75,w.z],m.glass,upper);for(const sign of [-1,1]){box(w.horizontal?[width,.045,.075]:[.075,.045,width],[w.x,sign<0?3.92:5.58,w.z],m.frame,upper);box(w.horizontal?[.045,1.7,.075]:[.075,1.7,.045],[w.x+(w.horizontal?sign*width/2:0),4.75,w.z+(w.horizontal?0:sign*width/2)],m.frame,upper);}}
    const deckMaterial=mat('#929e9d',.64,.65,{side:THREE.DoubleSide}),deckRoot=new THREE.Group();add(deckRoot);const deck=new THREE.Mesh(keep(new THREE.ExtrudeGeometry(outline,{depth:.1,bevelEnabled:false})),deckMaterial);deckRoot.add(deck);deck.rotation.x=-Math.PI/2;deck.position.y=7.4;deck.receiveShadow=true;decks.push({root:deckRoot,material:deckMaterial});
    for(const rib of deckRibs(f))box([.07,.045,rib.length],[rib.x,7.505,rib.z],deckMaterial,deckRoot);
    for(const p of roofPlan.columns.filter(p=>p.floor===f.id)){shape('column',[1,6.4,1],[p.x,0,p.z],m.frame);box([.2,.06,.2],[p.x,.03,p.z],m.silver);}

  }
  // Shared collision footprints are also the rendered partitions and equipment foundations.
  for(const o of obstacles){currentFloor=o.floor;
    const proxy=add(new THREE.Mesh(geos.box,m.wall));proxy.position.set(o.x,o.h/2,o.z);proxy.scale.set(o.w,o.h,o.d);proxy.userData.floor=o.floor;proxy.userData.type=o.type;proxy.userData.exterior=o.exterior;solids.push(proxy);
    if(o.type==='wall'){
      proxy.visible=false;proxy.scale.y=1.35;proxy.position.y=.675;continue;
    }
    if(o.type==='fixture'){proxy.visible=false;continue;}
    proxy.visible=false;box([o.w,.22,o.d],[o.x,.11,o.z],m.wall);
    const fallback=new THREE.Group();add(fallback);fallbacks.set(o,fallback);
    if(o.asset==='pipes'){
      const count=Math.ceil((o.w-.36)/3.8),rackX=Array.from({length:count+1},(_,i)=>o.x-o.w/2+.18+i*(o.w-.36)/count);
      for(const y of [.6,1.05,1.5]){pipe([o.x-o.w/2+.06,y,o.z],[o.x+o.w/2-.06,y,o.z],.16,m.silver,fallback);for(let x=o.x-o.w/2+.5;x<o.x+o.w/2-.2;x+=2.6)if(rackX.every(p=>Math.abs(p-x)>.2))shape('cylinder',[.22,.08,.22],[x,y,o.z],m.steel,[0,0,Math.PI/2],fallback);}
      const frame=new THREE.Group();add(frame);rackFallbacks.push(frame);
      for(const x of rackX){detailPlacements.pipe_rack.push({floor:o.floor,position:[x,.22,o.z],scale:[1,1,1]});
        for(const side of [-1,1]){box([.24,.06,.22],[x,.25,o.z+side*.52],m.steel,frame);box([.08,1.44,.08],[x,1,o.z+side*.52],m.frame,frame);}
        for(const y of [.39,.84,1.29])box([.12,.1,1.04],[x,y,o.z],m.frame,frame);
      }
    }else if(o.asset==='valves'){
      for(const dx of [-.5,.5]){pipe([o.x+dx,.22,o.z-1],[o.x+dx,1.7,o.z-1],.13,m.blue,fallback);pipe([o.x+dx,1.7,o.z-1],[o.x+dx,1.7,o.z+1],.13,m.blue,fallback);shape('torus',[.3,.3,.3],[o.x+dx,1.8,o.z],m.red,[Math.PI/2,0,0],fallback);}
    }else if(o.asset==='dock'){
      for(const dz of [-1.5,1.5])detailPlacements.maintenance_cart.push({floor:o.floor,position:[o.x,.22,o.z+dz],scale:[1,1,1]});
      for(const dz of [-1.5,1.5]){box([1.2,.1,.65],[o.x,.45,o.z+dz],m.steel,fallback);box([1.1,.08,.6],[o.x,1.1,o.z+dz],m.frame,fallback);for(const dx of [-.45,.45])for(const side of [-.23,.23])box([.06,.86,.06],[o.x+dx,.65,o.z+dz+side],m.frame,fallback);}
    }else if(o.asset==='warehouse'){
      for(const y of [.26,.96,1.66])box([o.w-.12,.08,o.d-.12],[o.x,y,o.z],m.steel,fallback);
      for(const dx of [-o.w/2+.1,o.w/2-.1])for(const dz of [-o.d/2+.1,o.d/2-.1])box([.1,o.h-.22,.1],[o.x+dx,.22+(o.h-.22)/2,o.z+dz],m.yellow,fallback);
      for(let z=o.z-o.d/2+.6;z<o.z+o.d/2-.45;z+=1.2)for(const y of [.575,1.275])box([o.w*.65,.55,.8],[o.x,y,z],m.cargo,fallback);
    }else{
      // Detailed GLB replaces this compact fallback only after it loads.
      if(o.asset==='control_cabinets'||o.asset==='oil_transformer')for(const dx of [-.65,.65]){box([1.1,2.1,1.2],[o.x+dx,1.12,o.z],m.blue,fallback);for(let y=.5;y<1.4;y+=.2)box([.85,.04,.04],[o.x+dx,y,o.z+.62],m.silver,fallback);}
      else {shape('cylinder',[.65,Math.min(o.d-.2,3),.65],[o.x,1,o.z],m.blue,[Math.PI/2,0,0],fallback);for(const dx of [-.75,.75])box([.15,.7,o.d*.7],[o.x+dx,.4,o.z],m.steel,fallback);}
    }
    if(o.waypoint==='WP11'){
      // Battery banks behind the UPS/control enclosures stay on the same pad.
      const z=o.z+o.d*.35,width=o.w-.3;
      for(const y of [.26,.96,1.66,2.36])box([width,.075,.65],[o.x,y,z],m.steel);
      for(const dx of [-width/2,width/2])box([.09,2.18,.65],[o.x+dx,1.31,z],m.steel);
      for(let x=o.x-width/2+.3;x<o.x+width/2-.2;x+=.55)for(const y of [.5635,1.2635,1.9635]){
        box([.43,.53,.45],[x,y,z],m.dark);
        for(const dx of [-.12,.12])shape('cylinder',[.028,.055,.028],[x+dx,y+.3,z],dx<0?m.red:m.silver);
      }
    }
    // Flush drainage grating stays walkable and below the fixed route dots.
    box([o.w*.85,.006,.13],[o.x,.003,o.z+o.d/2+.28],m.dark);for(let x=o.x-o.w*.425+.035;x<o.x+o.w*.425;x+=.09)box([.025,.004,.12],[x,.006,o.z+o.d/2+.28],m.silver);
    for(const side of [-1,1])box([o.w,.008,.045],[o.x,.01,o.z+side*(o.d/2+.15)],m.yellow);
    // Bolted foundations, gauges, service pipes stay inside the collision envelope.
    for(const dx of [-o.w*.4,o.w*.4])for(const dz of [-o.d*.4,o.d*.4])shape('cylinder',[.055,.07,.055],[o.x+dx,.25,o.z+dz],m.silver);
  }
  for(const bay of roofPlan.bays){const r=bay;currentFloor=r.floor;const [x1,y1,x2,y2]=r.rect,a=imageToWorld([x1,y1]),b=imageToWorld([x2,y2]);
    const roof=roofGroups[r.floor],{supports,point,purlins,center}=bay,cx=center.x,cz=center.z,width=bay.width,yaw=-Math.atan2(supports[1].z-supports[0].z,supports[1].x-supports[0].x);
    supports.forEach((p,i)=>beam(p,supports[(i+1)%4],6.32,roof));
    for(const [left,right] of [[supports[0],supports[1]],[supports[3],supports[2]]]){const dx=right.x-left.x,dz=right.z-left.z,length=Math.hypot(dx,dz),key=spanKey(left,right,6.35);if(length>.5&&!trussKeys.has(key)){trussKeys.add(key);const parent=new THREE.Group();parent.position.set((left.x+right.x)/2,6.35,(left.z+right.z)/2);parent.rotation.y=-Math.atan2(dz,dx);roof.add(parent);structuralPlacements.roof_truss.push({parent,scale:[length/6,1,1]});pipe([-length/2,0,0],[length/2,0,0],.075,m.frame,parent.userData.fallback=new THREE.Group());parent.add(parent.userData.fallback);}}
    for(const p of purlins)beam(p.a,p.b,7.24,roof);
    pipe([supports[0].x,7.24,supports[0].z],[supports[2].x,7.24,supports[2].z],.018,m.silver,roof);
    // Services use the same bay coordinates as purlins: every hanger touches a beam.
    for(const v of [.15,.85]){const start=point(.04,v),end=point(.96,v),length=Math.hypot(end.x-start.x,end.z-start.z);pipe([start.x,5.4,start.z],[end.x,5.4,end.z],.085,m.silver,roof);
      const tray=new THREE.Group();tray.position.set((start.x+end.x)/2,5.65,(start.z+end.z)/2);tray.rotation.y=-Math.atan2(end.z-start.z,end.x-start.x);roof.add(tray);box([length,.035,.025],[0,0,-.16],m.steel,tray);box([length,.035,.025],[0,0,.16],m.steel,tray);for(let x=-length/2;x<length/2;x+=.4)box([.025,.035,.34],[x,0,0],m.silver,tray);
      for(const purlin of purlins){const p=point(purlin.u,v),parent=new THREE.Group();parent.position.set(p.x,5.315,p.z);parent.rotation.y=yaw+Math.PI/2;roof.add(parent);structuralPlacements.pipe_hanger.push({parent,scale:[1,1,1]});for(const side of [-1,1]){const dx=Math.cos(yaw+Math.PI/2)*side*.22,dz=-Math.sin(yaw+Math.PI/2)*side*.22;pipe([p.x+dx,6.015,p.z+dz],[p.x+dx,7.24,p.z+dz],.014,m.silver,roof);if(side===1)pipe([p.x-dx,7.24,p.z-dz],[p.x+dx,7.24,p.z+dz],.027,m.frame,roof);}}
    }
    const ductA=point(.04,.28),ductB=point(.96,.28),ductLength=Math.hypot(ductB.x-ductA.x,ductB.z-ductA.z),duct=new THREE.Group();duct.position.set((ductA.x+ductB.x)/2,6.02,(ductA.z+ductB.z)/2);duct.rotation.y=yaw;roof.add(duct);box([ductLength,.32,.42],[0,0,0],m.silver,duct);for(let x=-ductLength/2+.5;x<ductLength/2;x+=1.6){box([.025,.35,.45],[x,0,0],m.frame,duct);}
    for(const purlin of purlins){const p=point(purlin.u,.28);pipe([p.x,6.2,p.z],[p.x,7.24,p.z],.016,m.silver,roof);}
    const fireA=point(.04,.72),fireB=point(.96,.72);pipe([fireA.x,5.05,fireA.z],[fireB.x,5.05,fireB.z],.045,m.red,roof);for(const purlin of purlins){const p=point(purlin.u,.72);pipe([p.x,5.05,p.z],[p.x,4.95,p.z],.015,m.silver,roof);pipe([p.x,5.09,p.z],[p.x,7.24,p.z],.011,m.silver,roof);}
    beam(point(0,.5),point(1,.5),6.32,roof);
    const fixture=new THREE.Group();fixture.position.set(cx,5.82,cz);fixture.rotation.y=yaw;roof.add(fixture);structuralPlacements.industrial_luminaire.push({parent:fixture,scale:[1,1,1]});
    box([1.5,.04,.28],[0,-.04,0],m.light,fixture.userData.fallback=new THREE.Group());fixture.add(fixture.userData.fallback);
    if(['WP03','WP08','WP12','WP15'].includes(r.id)){const lamp=new THREE.RectAreaLight('#edf1e8',3,Math.min(8,width),8);lamp.position.set(cx,5.68,cz);lamp.rotation.x=-Math.PI/2;groups[r.floor].add(lamp);}
    // Rounded risers tap the actual overhead header. Lower ports enter the
    // foundation as buried services; new pipework cannot block walking routes.
    for(const o of equipment.filter(e=>e.waypoint===r.id&&!['warehouse','dock'].includes(e.asset))){
      if(['control_cabinets','oil_transformer'].includes(o.asset)){
        const start={x:o.x+o.w*.42,z:o.z+o.d*.42},tap=headerTap(bay,start,.85);
        roundedPipe([[start.x,.22,start.z],[start.x,4.45,start.z],[tap.x,4.45,tap.z],[tap.x,5.65,tap.z]],.025,m.dark);
      }else for(const sign of [-1,1]){
        const start={x:o.x+sign*o.w*.42,z:o.z-o.d*.42},tap=headerTap(bay,start);
        roundedPipe([[start.x,.22,start.z],[start.x,4.7,start.z],[tap.x,4.7,tap.z],[tap.x,5.4,tap.z]],.06,m.blue);
        pipe([start.x,2.37,start.z],[start.x,2.43,start.z],.105,m.silver);
        for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a)*.083,dz=Math.sin(a)*.083;pipe([start.x+dx,2.35,start.z+dz],[start.x+dx,2.45,start.z+dz],.012,m.dark);}
      }
    }
    if(r.id==='WP05'){
      // Access platform fixed to the rear pipe-bank foundation; no walkway legs.
      const pad=equipment.find(o=>o.waypoint==='WP05'&&o.z<0),x=pad.x-pad.w/2+3,z=pad.z;
      box([4,.1,1.15],[x,2.02,z],m.steel);
      for(let dx=-1.9;dx<2;dx+=.16)box([.035,.03,1.12],[x+dx,2.085,z],m.silver);
      for(const dx of [-1.8,1.8])for(const dz of [-.48,.48]){
        box([.08,1.75,.08],[x+dx,1.095,z+dz],m.frame);
        pipe([x+dx,2.07,z+dz],[x+dx,3.07,z+dz],.025,m.yellow);
      }
      for(const dz of [-.48,.48])pipe([x-1.8,3.07,z+dz],[x+(dz>0?1.25:1.8),3.07,z+dz],.025,m.yellow);
      for(const dx of [-.25,.25])pipe([x+1.65+dx,.22,z+.6],[x+1.65+dx,2.08,z+.6],.025,m.silver);
      for(let y=.4;y<2;y+=.25)pipe([x+1.4,y,z+.6],[x+1.9,y,z+.6],.022,m.silver);
    }
  }
  for(const p of wallPanels){currentFloor=p.floor;
    const outward=p.horizontal?[0,0,p.side]:[p.side,0,0],wallX=p.x-outward[0]*.079,wallZ=p.z-outward[2]*.079;
    pipe([wallX,1.35,wallZ],[wallX,3.3,wallZ],.014,m.silver,wallMounts[p.floor]);
    for(const y of [1.4,2.6,3.25])box([.045,.04,.045],[wallX,y,wallZ],m.frame,wallMounts[p.floor]);
    // Warning plaques are physical signage, never fabricated inspection data.
    if(['WP02','WP05','WP11','WP14','WP15'].includes(p.waypoint)){
      const horizontal=p.horizontal,along=horizontal?'x':'z',position=[wallX,1.18,wallZ],half=(horizontal?p.wall.w:p.wall.d)/2;position[horizontal?0:2]=Math.min(p.wall[along]+half-.15,position[horizontal?0:2]+.55);
      box(horizontal?[.22,.16,.014]:[.014,.16,.22],position,m.yellow);
      box(horizontal?[.04,.075,.016]:[.016,.075,.04],[position[0],1.195,position[2]],m.dark);
      box(horizontal?[.035,.025,.016]:[.016,.025,.035],[position[0],1.137,position[2]],m.dark);
    }
  }
  const fitout=buildPlantFitout({resources,groups,upper:wallMounts,roofPlan,setFloor:f=>{currentFloor=f},box,shape,pipe,roundedPipe,m,fitoutPlacements});
  fitout.summary.dressing=buildRoomDressing({resources,groups,upper:wallMounts,setFloor:f=>{currentFloor=f},box,shape,pipe,m});
  for(const b of batches.values()){const mesh=new THREE.InstancedMesh(geos[b.kind],b.material,b.matrices.length);b.matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.receiveShadow=true;mesh.computeBoundingSphere();(b.parent||groups[b.floor]).add(mesh);keep(mesh);}
  function register(root){root.traverse(o=>{if(o.geometry)keep(o.geometry);for(const m of [].concat(o.material||[])){keep(m);for(const t of Object.values(m))if(t?.isTexture)keep(t);}});}
  function release(root){const items=[];root.traverse(o=>{if(o.geometry)items.push(o.geometry);for(const m of [].concat(o.material||[])){items.push(m);for(const t of Object.values(m))if(t?.isTexture)items.push(t);}});new Set(items).forEach(r=>r.dispose());}
  function fit(root,o,size=[o.w-.12,o.h-.22,o.d-.12],y=.22,attach=true){const group=new THREE.Group(),clone=root.clone(true);group.add(clone);group.updateMatrixWorld(true);const bound=new THREE.Box3().setFromObject(group),s=bound.getSize(new THREE.Vector3()),c=bound.getCenter(new THREE.Vector3()),scale=Math.min(...size.map((n,i)=>n/Math.max(.001,s.getComponent(i))));clone.position.sub(new THREE.Vector3(c.x,bound.min.y,c.z));group.scale.setScalar(scale);group.position.set(o.x,y,o.z);clone.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});if(attach)groups[o.floor].add(group);return group;}
  const loader=new GLTFLoader(),failed=[];let count=0;const names=[...engineeredAssetNames,...industrialAssetNames];onAssets({loaded:0,total:names.length,failed:[]});
  names.push(...Object.keys(structuralPlacements),...Object.keys(detailPlacements),...fitoutAssetNames,'service_manifold');onAssets({loaded:0,total:names.length,failed:[]});
  const jobs=names.map(async name=>{try{const path=fitoutPlacements[name]?'fitout':detailPlacements[name]?'details':name==='service_manifold'?'services':structuralPlacements[name]?'structural':engineeredAssetNames.includes(name)?'engineered':'industrial',gltf=await loader.loadAsync('/models/'+path+'/'+name+'.glb');if(disposed){release(gltf.scene);return;}register(gltf.scene);
    if(path==='structural'){
      const instances=new Map();gltf.scene.updateMatrixWorld(true);
      for(const p of structuralPlacements[name]){p.parent.updateWorldMatrix(true,false);let ancestor=p.parent;while(ancestor.parent&&!Object.values(roofGroups).includes(ancestor))ancestor=ancestor.parent;const floor=Object.keys(roofGroups).find(id=>roofGroups[id]===ancestor),scale=new THREE.Matrix4().makeScale(...p.scale);gltf.scene.traverse(o=>{if(!o.isMesh)return;const key=floor+o.uuid;if(!instances.has(key))instances.set(key,{o,floor,matrices:[]});instances.get(key).matrices.push(p.parent.matrixWorld.clone().multiply(scale).multiply(o.matrixWorld));});if(p.parent.userData.fallback)p.parent.userData.fallback.visible=false;}
      for(const b of instances.values()){const mesh=new THREE.InstancedMesh(b.o.geometry,b.o.material,b.matrices.length);b.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.receiveShadow=true;roofGroups[b.floor].add(mesh);keep(mesh);}
    }
    if(path==='details'){
      const instances=new Map();gltf.scene.updateMatrixWorld(true);for(const p of detailPlacements[name]){const transform=new THREE.Matrix4().compose(new THREE.Vector3(...p.position),new THREE.Quaternion(),new THREE.Vector3(...p.scale));gltf.scene.traverse(o=>{if(!o.isMesh)return;const key=p.floor+o.uuid;if(!instances.has(key))instances.set(key,{geometry:o.geometry,material:o.material,floor:p.floor,matrices:[]});instances.get(key).matrices.push(transform.clone().multiply(o.matrixWorld));});}
      for(const b of instances.values()){const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;groups[b.floor].add(mesh);keep(mesh);}
      if(name==='pipe_rack')rackFallbacks.forEach(g=>g.visible=false);else for(const o of equipment.filter(e=>e.asset==='dock'))fallbacks.get(o).visible=false;
    }
    if(path==='fitout'){
      const instances=new Map();gltf.scene.updateMatrixWorld(true);
      for(const p of fitoutPlacements[name]){const transform=new THREE.Matrix4().compose(new THREE.Vector3(...p.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw||0),new THREE.Vector3(...p.scale));
        gltf.scene.traverse(o=>{if(!o.isMesh)return;const key=p.floor+o.uuid;if(!instances.has(key))instances.set(key,{geometry:o.geometry,material:o.material,floor:p.floor,matrices:[]});instances.get(key).matrices.push(transform.clone().multiply(o.matrixWorld));});if(p.fallback)p.fallback.visible=false;}
      for(const b of instances.values()){const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;groups[b.floor].add(mesh);keep(mesh);}
    }
    if(path==='services'){
      const instances=new Map(),connectors=new Map();gltf.scene.updateMatrixWorld(true);
      for(const p of servicePlacements){const group=fit(gltf.scene,p,p.size,.22,false);group.updateMatrixWorld(true);group.traverse(o=>{if(!o.isMesh)return;const key=p.floor+o.geometry.uuid+o.material.uuid;if(!instances.has(key))instances.set(key,{geometry:o.geometry,material:o.material,floor:p.floor,matrices:[]});instances.get(key).matrices.push(o.matrixWorld.clone());});
        for(const port of servicePorts){const point=group.localToWorld(new THREE.Vector3(...port).add(group.children[0].position)),length=point.y-.22,matrix=new THREE.Matrix4().compose(new THREE.Vector3(point.x,.22+length/2,point.z),new THREE.Quaternion(),new THREE.Vector3(.085*group.scale.x,length,.085*group.scale.x));if(!connectors.has(p.floor))connectors.set(p.floor,{geometry:geos.cylinder,material:m.blue,floor:p.floor,matrices:[]});connectors.get(p.floor).matrices.push(matrix);}
      }
      for(const b of [...instances.values(),...connectors.values()]){const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;groups[b.floor].add(mesh);keep(mesh);}
    }
    if(path==='engineered')for(const o of equipment.filter(e=>e.asset===name)){fit(gltf.scene,o);fallbacks.get(o).visible=false;}
    if(name==='industrial_electrical_box')for(const p of wallPanels){const panel=fit(gltf.scene,p,p.size,p.y);panel.rotation.y=p.yaw;wallMounts[p.floor].add(panel);}
    const find=part=>{let result;gltf.scene.traverse(o=>{if(o.isMesh&&o.name.includes(part))result=o;});return result;};
    if(name==='large_modular_pipes_metal'){const valve=find('BigValve');if(valve)for(const o of equipment.filter(e=>['pipes','valves'].includes(e.asset)))fit(valve,o,[.6,.5,.6],1.7);}
    if(name==='industrial_pipes_pack'){const junction=find('Cylinder_011')||find('Cylinder.011');if(junction)for(const o of equipment.filter(e=>e.asset==='pipes'))fit(junction,o,[1.1,.65,1],1.2);}
    // The exterior factory shell is deliberately not placed: the reference defines no yard.
  }catch(e){failed.push(name);console.warn('Industrial component unavailable:',name,e.message);}finally{if(!disposed)onAssets({loaded:++count,total:names.length,failed:[...failed]});}});
  return {solids,groups,fitout,setRoof:(mode,cameraMode,dt)=>{const open=mode!=='full'||cameraMode==='top';upperWalls.forEach(o=>{o.visible=!open;});Object.values(roofGroups).forEach(o=>{o.visible=mode!=='hidden'&&mode!=='overhead'&&cameraMode!=='top';});decks.forEach(({root,material})=>{const alpha=open?0:1;material.opacity+=(alpha-material.opacity)*(1-Math.exp(-dt*12));material.transparent=material.opacity<.99;material.depthWrite=material.opacity>.99;root.visible=material.opacity>.01;});solids.filter(o=>o.userData.type==='wall').forEach(o=>{o.scale.y=open?1.35:o.userData.exterior?7.4:3.5;o.position.y=o.scale.y/2;});},setFloor:f=>Object.entries(groups).forEach(([id,g])=>{g.visible=f==='all'||f===id;}),ready:Promise.all(jobs),dispose:()=>{disposed=true;}};
}
