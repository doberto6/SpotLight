import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {equipment} from './facility-layout.mjs';
import {roomStations,doorOpenings,workshop} from './room-fitout.mjs';

// Repeated fixtures use the environment's existing instance batches and shared
// PBR materials. Only signs and the single data-fed screen need their own mesh.
export function buildPlantFitout({resources,groups,upper,roofPlan,setFloor,box,shape,pipe,roundedPipe,m,fitoutPlacements}){
 const keep=r=>(resources.push(r),r),rotors=[],atlas=document.createElement('canvas');atlas.width=2048;atlas.height=1024;
 const ctx=atlas.getContext('2d');
 roomStations.forEach((p,i)=>{const x=i%4*512,y=Math.floor(i/4)*256;
  ctx.fillStyle='#1d3036';ctx.fillRect(x,y,512,256);ctx.fillStyle=p.identity[2];ctx.fillRect(x,y,512,14);
  ctx.fillStyle='#ebf1ed';ctx.font='bold 46px Arial';ctx.fillText(p.waypoint,x+22,y+65);ctx.font='bold 31px Arial';ctx.fillText(p.identity[0],x+22,y+115);
  ctx.fillStyle='#dbc86d';ctx.font='25px Arial';ctx.fillText(p.identity[1],x+22,y+169);ctx.fillStyle='#91b6c0';ctx.font='21px Arial';ctx.fillText('SPOTlight  /  INSPECTION BAY',x+22,y+220);
 });
 const texture=keep(new THREE.CanvasTexture(atlas));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const signMaterial=keep(new THREE.MeshStandardMaterial({map:texture,roughness:.75,metalness:.15}));
 const panelMat=keep(new THREE.MeshStandardMaterial({color:'#687d7c',roughness:.65,metalness:.35}));
 const fireMat=keep(new THREE.MeshStandardMaterial({color:'#ad3f35',roughness:.48,metalness:.35}));
 const insulation=keep(new THREE.MeshStandardMaterial({color:'#bec3ba',roughness:.84,metalness:.15}));
 const screenMaterial=keep(new THREE.MeshStandardMaterial({color:'#14252b',roughness:.5,metalness:.2}));
 const plane=(width,height,pos,yaw,material,parent,index=null)=>{
  const geo=keep(new THREE.PlaneGeometry(width,height));if(index!==null){const uv=geo.attributes.uv,x=index%4/4,y=1-Math.floor(index/4)/4;for(let i=0;i<uv.count;i++)uv.setXY(i,x+uv.getX(i)/4,y-.25+uv.getY(i)/4);}
  const mesh=new THREE.Mesh(geo,material);mesh.position.set(...pos);mesh.rotation.y=yaw;parent.add(mesh);return mesh;
 };
 for(const [i,p] of roomStations.entries()){
  setFloor(p.floor);const normal=p.horizontal?[0,p.side]:[p.side,0],along=p.horizontal?[1,0]:[0,1];
  const point=(s,y,depth=.012)=>[p.x+along[0]*s+normal[0]*(depth-.086),y,p.z+along[1]*s+normal[1]*(depth-.086)];
  // Readable identification remains on the lower wall in cutaway view.
  plane(p.width,.38,point(0,1.12),p.yaw,signMaterial,groups[p.floor],i);
  for(const s of [-p.width/2+.035,p.width/2-.035])for(const y of [.97,1.27])shape('sphere',[.012,.012,.012],point(s,y,.018),m.silver);
  const span=Math.min(1.1,p.width),parent=upper[p.floor];
  box(p.horizontal?[span,.065,.055]:[.055,.065,span],point(0,2.98,.027),m.dark,parent);
  for(const s of [-span/2+.05,span/2-.05]){
   pipe(point(s,2.98,.04),point(s,2.45,.04),.013,m.silver,parent);
   box(p.horizontal?[.07,.09,.035]:[.035,.09,.07],point(s,2.72,.032),m.frame,parent);
  }
  // Vent bezel, recessed dark opening and individual louvres at a wall face.
  box(p.horizontal?[span,.4,.07]:[.07,.4,span],point(0,2.48,.042),panelMat,parent);
  box(p.horizontal?[span-.08,.31,.018]:[.018,.31,span-.08],point(0,2.48,.083),m.dark,parent);
  for(let y=2.35;y<2.63;y+=.048)box(p.horizontal?[span-.1,.022,.028]:[.028,.022,span-.1],point(0,y,.1),m.silver,parent);
  // Fire equipment in selected access/mechanical bays, above robot clearance.
  if(['WP01','WP03','WP06','WP07','WP08','WP12','WP15'].includes(p.waypoint)){
   const offset=p.width/2+.24,max=(Math.max(p.wall.w,p.wall.d)/2)-.14,center=p.horizontal?p.x:p.z,wallCenter=p.horizontal?p.wall.x:p.wall.z;
   const s=Math.max(-max,Math.min(max,center-wallCenter+offset))-(center-wallCenter);
   pipe(point(s,.84,.1),point(s,1.18,.1),.075,fireMat);
   shape('sphere',[.075,.05,.075],point(s,.84,.1),fireMat);shape('sphere',[.075,.045,.075],point(s,1.18,.1),fireMat);
   box([.12,.025,.05],point(s,1.245,.1),m.dark);pipe(point(s+.06,1.23,.11),point(s+.1,.96,.11),.009,m.dark);
   box(p.horizontal?[.18,.055,.02]:[.02,.055,.18],point(s,1.23,.014),m.red);
  }
 }
 for(const d of doorOpenings()){
  setFloor(d.floor);for(const sign of [-1,1]){
   const pos=[d.x+(d.horizontal?sign*(d.width/2+.035):0),1.175,d.z+(d.horizontal?0:sign*(d.width/2+.035))];
   box(d.horizontal?[.065,2.35,.18]:[.18,2.35,.065],pos,m.frame);
   for(const y of [.35,1.12,1.9])box(d.horizontal?[.045,.07,.2]:[.2,.07,.045],[pos[0],y,pos[2]],m.silver);
  }
  box(d.horizontal?[d.width+.13,.12,.18]:[.18,.12,d.width+.13],[d.x,2.36,d.z],m.frame,upper[d.floor]);
  box(d.horizontal?[.36,.1,.2]:[.2,.1,.36],[d.x,2.5,d.z],m.light,upper[d.floor]);
 }
 for(const o of equipment){
  setFloor(o.floor);
  if(!['warehouse','dock','pipes'].includes(o.asset)){
   const x=o.x-o.w/2+.16,z=o.z+o.d/2-.17;
   pipe([x,.22,z],[x,.97,z],.018,m.silver);
   shape('cylinder',[.105,.055,.105],[x,1.03,z],m.silver,[Math.PI/2,0,0]);
   shape('cylinder',[.084,.057,.084],[x,1.03,z+.005],m.light,[Math.PI/2,0,0]);
   pipe([x,1.03,z+.038],[x-.045,1.07,z+.038],.006,m.dark);
   for(let a=0;a<Math.PI*2;a+=Math.PI/4)box([.009,.009,.005],[x+Math.cos(a)*.067,1.03+Math.sin(a)*.067,z+.036],m.dark);
   // An inspection junction box and lockable disconnect on the pad edge.
   const disconnectX=o.x+o.w/2-.14;
   box([.12,.03,.12],[disconnectX,.235,z],m.silver);
   pipe([disconnectX,.25,z],[disconnectX,.84,z],.025,m.silver);
   box([.16,.18,.12],[o.x+o.w/2-.14,.93,z],panelMat);
   box([.022,.065,.018],[o.x+o.w/2-.14,.93,z+.066],m.red);
  }
  if(['pressure_vessel','heat_exchanger','turbine_generator'].includes(o.asset))for(const sign of [-1,1]){
   const x=o.x+sign*o.w*.42,z=o.z-o.d*.42;
   pipe([x,2.6,z],[x,3.65,z],.102,insulation);
   for(const y of [2.6,3.12,3.65])pipe([x,y-.012,z],[x,y+.012,z],.107,m.silver);
  }
  if(o.asset==='warehouse'){
   let i=0;for(let z=o.z-o.d/2+.55;z<o.z+o.d/2-.5;z+=1.15,i++){
    if(i%2){
     shape('cylinder',[.22,.37,.22],[o.x,1.95,z],m.dark,[0,0,Math.PI/2]);
     for(const dx of [-.22,.22])shape('cylinder',[.25,.035,.25],[o.x+dx,1.95,z],m.cargo,[0,0,Math.PI/2]);
    }else for(const dx of [-.16,.16])pipe([o.x+dx,1.78,z-.38],[o.x+dx,1.78,z+.38],.078,m.silver);
   }
  }
  if(['compressor','oil_transformer','control_cabinets'].includes(o.asset)){
   const x=o.x+o.w*.27,y=1.62,z=o.z+o.d/2-.035,bladeParts=[];
   for(let i=0;i<3;i++){
    const angle=i*Math.PI*2/3,geometry=new THREE.BoxGeometry(.075,.2,.012);
    geometry.translate(0,.11,0);geometry.rotateZ(angle);bladeParts.push(geometry);
   }
   const geometry=keep(mergeGeometries(bladeParts));bladeParts.forEach(g=>g.dispose());
   const rotor=new THREE.Mesh(geometry,m.steel);rotor.position.set(x,y,z);groups[o.floor].add(rotor);rotors.push(rotor);
   // Guard rings and bars remain fixed; only the enclosed fan blades move.
   for(const radius of [.09,.16,.235])shape('torus',[radius,radius,radius],[x,y,z+.018],m.silver);
   for(let i=0;i<4;i++){
    const angle=i*Math.PI/4,dx=Math.cos(angle)*.245,dy=Math.sin(angle)*.245;
    pipe([x-dx,y-dy,z+.02],[x+dx,y+dy,z+.02],.006,m.silver);
   }
  }
 }
 // The workshop model occupies the unused middle of the existing maintenance pad.
 const benchFallback=new THREE.Group();groups[workshop.floor].add(benchFallback);
 fitoutPlacements.maintenance_workbench.push({floor:workshop.floor,position:[workshop.x,.22,workshop.z],scale:[1,1,1],yaw:Math.PI/2,parent:groups[workshop.floor],fallback:benchFallback});
 setFloor(workshop.floor);box([.66,.065,1.34],[workshop.x,1.08,workshop.z],m.steel,benchFallback);
 for(const bay of roofPlan.bays.filter(b=>['WP08','WP09'].includes(b.id))){
  setFloor(bay.floor);const g=new THREE.Group();groups[bay.floor].add(g);
  // Rails are hung from the existing perimeter beams. The parked hook is
  // above the machinery and the bridge lies between the existing service runs.
  for(const u of [.02,.98]){
   const a=bay.point(u,0),b=bay.point(u,1);pipe([a.x,5.1,a.z],[b.x,5.1,b.z],.055,m.steel);
   for(const v of [0,1]){const p=bay.point(u,v);pipe([p.x,5.1,p.z],[p.x,6.32,p.z],.035,m.frame);}
  }
  const a=bay.point(.02,.43),b=bay.point(.98,.43),length=Math.hypot(b.x-a.x,b.z-a.z),yaw=-Math.atan2(b.z-a.z,b.x-a.x);
  const bridge=new THREE.Group();bridge.position.set((a.x+b.x)/2,5.02,(a.z+b.z)/2);bridge.rotation.y=yaw;g.add(bridge);
  box([length,.18,.24],[0,0,0],m.yellow,bridge);
  const trolley=bay.point(.23,.43);fitoutPlacements.bridge_hoist.push({floor:bay.floor,position:[trolley.x,4.11,trolley.z],scale:[1,1,1],yaw,parent:g});
 }
 // Data displayed here comes from the same replay state as the dashboard.
 const station=equipment.find(o=>o.waypoint==='WP02'),display=document.createElement('canvas');display.width=768;display.height=512;
 const displayTexture=keep(new THREE.CanvasTexture(display));displayTexture.colorSpace=THREE.SRGBColorSpace;
 const displayMat=keep(new THREE.MeshStandardMaterial({map:displayTexture,emissive:'#ffffff',emissiveMap:displayTexture,emissiveIntensity:.35,roughness:.7}));
 setFloor(station.floor);box([Math.min(1.8,station.w-.2),1.05,.035],[station.x,1.66,station.z+station.d/2-.036],screenMaterial);
 plane(Math.min(1.7,station.w-.3),.96,[station.x,1.66,station.z+station.d/2-.016],0,displayMat,groups[station.floor]);
 let screenKey='';const drawStatus=({missionId,pose,progress,manual,findings})=>{
  const key=[missionId,pose.floor,pose.destination,Math.round(progress*100),manual,findings].join(':');if(key===screenKey)return;screenKey=key;
  const c=display.getContext('2d');c.fillStyle='#10262e';c.fillRect(0,0,768,512);c.fillStyle='#81cfb3';c.font='bold 40px Arial';c.fillText('SPOT / MISSION MONITOR',30,58);
  c.fillStyle='#afc7ca';c.font='24px Arial';c.fillText('RECORDED SYNTHETIC DATA / VIRTUAL POSITION',30,99);
  c.fillStyle='#eef4ef';c.font='bold 54px Arial';c.fillText(missionId||'MISSION',30,177);
  c.font='30px Arial';c.fillText(`FLOOR ${pose.floor||'—'}  /  ${pose.destination||'COMPLETE'}`,30,232);c.fillText(manual?'MANUAL SIMULATION':'MISSION REPLAY',30,287);
  c.fillStyle='#29464e';c.fillRect(30,321,700,24);c.fillStyle='#81cfb3';c.fillRect(30,321,700*Math.max(0,Math.min(1,progress)),24);
  c.fillStyle='#afc7ca';c.font='28px Arial';c.fillText(`${Math.round(progress*100)}% ROUTE    /    ${findings} RECORDED FINDINGS`,30,395);
  c.font='23px Arial';c.fillText('Select an inspection target to review source readings.',30,467);displayTexture.needsUpdate=true;
 };
 return {drawStatus,animate:dt=>{for(const rotor of rotors)if(rotor.parent.visible)rotor.rotation.z=(rotor.rotation.z+dt*3)%(Math.PI*2);},summary:{rooms:roomStations.length,doorFrames:doorOpenings().length,cranes:2,workbenches:1,coolingFans:rotors.length}};
}
