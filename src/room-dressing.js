import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {equipment} from './facility-layout.mjs';
import {roomDetailAnchors,roomKits} from './room-dressing.mjs';
import {buildRoomFurniture} from './room-furniture.js';

const titles={safety:'PPE / EMERGENCY STATION',firstAid:'FIRST AID / SAFETY EQUIPMENT',switchboard:'DISTRIBUTION / ISOLATION',communications:'COMMUNICATIONS / CABLE PATCHING',water:'COOLING WATER / LOCAL SERVICES',manifold:'PROCESS VALVE MANIFOLD',motorControls:'MOTOR STARTERS / LOCAL ISOLATION',steam:'STEAM SERVICES / INSULATED PIPEWORK',air:'COMPRESSED AIR / FILTER REGULATION',lubrication:'LUBRICATION / FILTER SERVICE',battery:'BATTERY DC / FUSED DISTRIBUTION',parts:'SPARES / MECHANICAL COMPONENTS',inventory:'STORES / PARTS BINS',tools:'MAINTENANCE / TOOL BOARD'};

// All assembly bottoms are above the 0.73 m walking envelope. No new floor
// obstacles: service boards are wall-supported, spare parts sit on old shelves,
// and cart loads stay on their existing foundations. Repeated parts are batched.
export function buildRoomDressing({resources,groups,upper,setFloor,box,shape,pipe,m}){
 const keep=r=>(resources.push(r),r),anchors=roomDetailAnchors(),labels={1:[],2:[]};
 const painted=keep(new THREE.MeshStandardMaterial({color:'#526966',roughness:.68,metalness:.32}));
 const ceramic=keep(new THREE.MeshStandardMaterial({color:'#c7d0bf',roughness:.62,metalness:.03}));
 const amber=keep(new THREE.MeshStandardMaterial({color:'#be9148',roughness:.56,metalness:.25}));
 const labelCanvas=document.createElement('canvas');labelCanvas.width=2048;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d'),kits=Object.keys(titles);
 kits.forEach((k,i)=>{const x=i%4*512,y=Math.floor(i/4)*32;ctx.fillStyle='#24363b';ctx.fillRect(x,y,512,32);ctx.fillStyle='#dce7dc';ctx.font='bold 19px Arial';ctx.textAlign='center';ctx.fillText(titles[k],x+256,y+23);});
 const labelTexture=keep(new THREE.CanvasTexture(labelCanvas));labelTexture.colorSpace=THREE.SRGBColorSpace;labelTexture.anisotropy=4;
 const labelMaterial=keep(new THREE.MeshStandardMaterial({map:labelTexture,roughness:.85,metalness:0}));
 for(const p of anchors){
  setFloor(p.floor);const normal=p.axis==='x'?[p.normal,0]:[0,p.normal],along=p.axis==='x'?[0,1]:[1,0],w=p.width,s=w/1.65;
  const pos=(u,y,d=.06)=>[p.x+along[0]*u*s+normal[0]*d,y,p.z+along[1]*u*s+normal[1]*d];
  const slab=(width,height,depth,u,y,d,material,parent)=>box(p.axis==='x'?[depth,height,width*s]:[width*s,height,depth],pos(u,y,d),material,parent);
  const line=(a,b,r,material,parent)=>pipe(pos(...a),pos(...b),r,material,parent);
  const disc=(u,y,r,material,d=.115)=>shape('cylinder',[r,.016,r],pos(u,y,d),material,p.axis==='x'?[0,0,Math.PI/2]:[Math.PI/2,0,0]);
  const wheel=(u,y,r=.07)=>{
   shape('torus',[r,r,r],pos(u,y,.165),m.red,p.axis==='x'?[0,Math.PI/2,0]:[0,0,0]);
   line([u-r,y,.165],[u+r,y,.165],.007,m.red);line([u,y-r,.165],[u,y+r,.165],.007,m.red);disc(u,y,.018,m.silver,.17);
  };
  const gauge=(u,y)=>{disc(u,y,.058,m.silver,.121);disc(u,y,.046,ceramic,.137);line([u,y,.15],[u-.018,y+.025,.15],.003,m.dark);};
  slab(w/s,.49,.032,0,1.055,.017,painted);
  for(const u of [-.78,.78])for(const y of [.837,1.274])disc(u,y,.009,m.silver,.038);
  // The shared atlas is merged per floor; these are static engineering labels.
  const index=kits.indexOf(p.kit),geo=new THREE.PlaneGeometry(w-.12,.088),uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(index%4+uv.getX(i))/4,1-(Math.floor(index/4)+1-uv.getY(i))/4);
  const yaw=p.axis==='x'?(p.normal>0?Math.PI/2:-Math.PI/2):(p.normal>0?0:Math.PI);geo.rotateY(yaw);geo.translate(...pos(0,1.246,.036));labels[p.floor].push(geo);
  if(['switchboard','motorControls','battery','communications'].includes(p.kit)){
   const count=p.kit==='communications'?4:3;
   for(let i=0;i<count;i++){
    const u=(i-(count-1)/2)*1.32/count,width=1.23/count;
    slab(width,.315,.064,u,1.048,.064,ceramic);
    slab(width-.035,.235,.014,u,1.06,.104,m.dark);
    if(p.kit==='communications'){
     for(const y of [.97,1.035,1.1])for(const du of [-.065,.065])slab(.045,.022,.014,u+du,y,.117,m.silver);
     for(const du of [-.06,.06])line([u+du,.96,.13],[u+du,.92,.15],.008,m.blue);
    }else{
     slab(.04,.087,.025,u,1.04,.124,m.silver);disc(u-.07,1.13,.017,amber,.123);
     for(const du of [-.08,.08])disc(u+du,.95,.018,du<0?m.red:m.blue,.12);
    }
    // Feed conduit reaches a wall cable trunk on the full-height wall.
    line([u,1.2,.055],[u,2.02,.055],.012,m.silver,upper[p.floor]);
   }
   slab(1.58,.10,.065,0,2.025,.04,painted,upper[p.floor]);
  }else if(['water','manifold','steam','air','lubrication'].includes(p.kit)){
   const fluid=p.kit==='steam'?ceramic:p.kit==='lubrication'?amber:m.blue;
   line([-.69,.975,.11],[.69,.975,.11],.031,fluid);
   for(const u of [-.48,0,.48]){
    line([u,.90,.11],[u,1.16,.11],.028,fluid);disc(u,.975,.05,m.silver,.11);wheel(u,1.09,.056);
    slab(.09,.18,.025,u,1.008,.035,m.frame);
   }
   for(const u of [-.72,.72]){
    line([u,.91,.11],[u,1.16,.11],.034,m.silver);
    line([u,1.16,.11],[u,1.58,.11],.023,fluid,upper[p.floor]);
    slab(.10,.035,.035,u,1.22,.11,m.silver);
   }
   gauge(.25,1.15);
   if(p.kit==='air'||p.kit==='lubrication')for(const u of [-.28,.28]){
    line([u,.88,.11],[u,1.02,.11],.052,ceramic);slab(.13,.032,.13,u,1.026,.11,m.dark);
   }
   if(p.kit==='steam')for(const u of [-.54,.54])slab(.022,.075,.087,u,.975,.11,m.silver);
   // Large upper louvre and a supported local exhaust casing, roof-aware.
   slab(1.15,.4,.16,0,2.5,.08,painted,upper[p.floor]);
   for(let y=2.35;y<2.66;y+=.06)slab(1.04,.023,.045,0,y,.175,m.silver,upper[p.floor]);
  }else if(p.kit==='safety'||p.kit==='firstAid'){
   slab(.85,.34,.11,-.27,1.025,.085,ceramic);
   slab(.70,.265,.015,-.27,1.025,.15,painted);
   // Cross symbol / PPE cubbies, without pretending to be live controls.
   if(p.kit==='firstAid'){slab(.19,.055,.012,-.27,1.04,.164,ceramic);slab(.055,.19,.012,-.27,1.04,.165,ceramic);}
   else for(const u of [-.47,-.07]){shape('sphere',[.065,.035,.065],pos(u,1.04,.19),amber);slab(.14,.025,.08,u,1.012,.18,m.silver);}
   slab(.32,.28,.045,.50,1.04,.042,m.red);disc(.50,1.08,.058,ceramic,.078);disc(.50,1.08,.034,m.red,.095);
   slab(.32,.06,.08,.50,.86,.06,m.silver);
  }else if(p.kit==='tools'){
   // Slotted backboard, hanging spanners and drivers have visible hooks.
   for(let u=-.65;u<.7;u+=.13)for(const y of [.91,1.01,1.11])disc(u,y,.008,m.dark,.037);
   for(let i=0;i<6;i++){
    const u=-.59+i*.235;line([u,1.16,.04],[u,1.16,.085],.007,m.silver);
    line([u,.93,.086],[u,1.13,.086],i%2?.011:.017,m.silver);disc(u,1.13,.033,m.silver,.083);
    if(i%2)slab(.04,.095,.035,u,.956,.087,m.blue);
   }
   slab(1.48,.022,.16,0,.845,.08,m.steel);
  }else{
   const inventory=p.kit==='inventory';
   for(const y of [.848,1.052]){
    slab(1.48,.022,.20,0,y,.10,m.steel);
    for(const u of [-.59,-.20,.20,.59]){
     if(inventory){slab(.32,.13,.16,u,y+.077,.112,amber);slab(.12,.035,.006,u,y+.076,.198,ceramic);}
     else{
      disc(u,y+.081,.065,m.silver,.11);disc(u,y+.081,.030,m.dark,.128);
      slab(.15,.025,.16,u,y+.025,.10,m.frame);
     }
    }
   }
   for(const u of [-.70,.70]){slab(.025,.045,.17,u,.819,.085,m.frame);line([u,.824,.023],[u,.845,.16],.008,m.silver);}
  }
  // Caged wall luminaire with visible mounting/backplate; no extra point lights.
  slab(.42,.16,.035,.50,2.94,.023,m.dark,upper[p.floor]);
  slab(.36,.10,.073,.50,2.94,.078,m.light,upper[p.floor]);
  for(const u of [.36,.50,.64])slab(.009,.12,.023,u,2.94,.13,m.silver,upper[p.floor]);
 }
 for(const floor of ['1','2'])if(labels[floor].length){const geometry=keep(mergeGeometries(labels[floor]));labels[floor].forEach(g=>g.dispose());groups[floor].add(new THREE.Mesh(geometry,labelMaterial));}
 // Complete the already occupied store racks: cargo straps, pull handles,
 // yellow shelf identification strips and stocked upper component shelves.
 for(const o of equipment.filter(e=>e.asset==='warehouse')){
  setFloor(o.floor);
  for(let z=o.z-o.d/2+.6;z<o.z+o.d/2-.45;z+=1.2)for(const y of [.575,1.275]){
   for(const dz of [-.24,.24]){
    box([o.w*.66,.014,.024],[o.x,y+.282,z+dz],m.dark);
    for(const sign of [-1,1])box([.014,.55,.024],[o.x+sign*(o.w*.325+.004),y,z+dz],m.dark);
   }
   for(const sign of [-1,1]){
    box([.015,.06,.14],[o.x+sign*(o.w*.325+.009),y,z],m.dark);
    box([.012,.08,.21],[o.x+sign*(o.w*.325+.018),y-.08,z],ceramic);
   }
  }
  for(const y of [.27,.97,1.67])for(const sign of [-1,1])box([.012,.035,o.d-.2],[o.x+sign*(o.w/2-.05),y,o.z],amber);
 }
 // Tool cases are supported by the existing two maintenance cart decks.
 const dock=equipment.find(o=>o.asset==='dock');setFloor(dock.floor);
 for(const sign of [-1,1]){
  const z=dock.z+sign*1.5,x=dock.x+.26;
  box([.40,.21,.37],[x,1.17,z],painted);
  box([.42,.025,.39],[x,1.2875,z],m.dark);
  for(const dx of [-.12,.12])box([.025,.05,.012],[x+dx,1.20,z+.191],m.silver);
  pipe([x-.07,1.312,z],[x+.07,1.312,z],.012,m.dark);
 }
 const furniture=buildRoomFurniture({setFloor,box,shape,pipe,m,painted,ceramic,amber});
 return {rooms:Object.keys(roomKits).length,serviceBoards:anchors.length,furniture,twoToneWalls:true};
}
