import {rooms,obstacles,imageToWorld} from './facility-layout.mjs';
import {wallFootprint} from './facility-structure.mjs';
import {roomStations} from './room-fitout.mjs';

export const roomKits={
 WP01:['safety','firstAid'],WP02:['switchboard','communications'],WP03:['water','manifold'],
 WP04:['manifold','motorControls'],WP05:['steam','manifold'],WP06:['air','motorControls'],
 WP07:['safety','communications'],WP08:['lubrication','motorControls'],WP09:['lubrication','switchboard'],
 WP10:['manifold','water'],WP11:['battery','communications'],WP12:['water','steam'],
 WP13:['parts','inventory'],WP14:['switchboard','motorControls'],WP15:['tools','parts']
};
export const wallPalette={access:'#4c6860',control_cabinets:'#657168',pump_skid:'#506d73',pipes:'#77745c',compressor:'#566d79',turbine_generator:'#5c717a',valves:'#506d73',heat_exchanger:'#506d73',warehouse:'#797361',oil_transformer:'#657168',dock:'#4c6860'};
const bounds=r=>{const a=imageToWorld(r.rect.slice(0,2)),b=imageToWorld(r.rect.slice(2));return {x0:a.x,x1:b.x,z0:a.z,z1:b.z};};
const contains=(r,x,z)=>{const b=bounds(r);return x>=b.x0-.015&&x<=b.x1+.015&&z>=b.z0-.015&&z<=b.z1+.015;};

// Split exposed union faces where room bounds change, including both faces of
// partitions. This avoids coplanar skins and trim inside intersecting walls.
export function finishedWallEdges(floor){
 const plan=wallFootprint(obstacles.filter(o=>o.type==='wall'&&o.floor===floor)),result=[];
 for(const e of plan.edges){
  const cuts=[e.a,e.b];
  for(const r of rooms.filter(r=>r.floor===floor)){
   const b=bounds(r),line=e.line+e.normal*.13;
   if(e.axis==='x'?(line<b.x0-.015||line>b.x1+.015):(line<b.z0-.015||line>b.z1+.015))continue;
   for(const t of e.axis==='x'?[b.z0,b.z1]:[b.x0,b.x1])if(t>e.a+.01&&t<e.b-.01)cuts.push(t);
  }
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b);
  for(let i=1;i<sorted.length;i++){
   const a=sorted[i-1],b=sorted[i],t=(a+b)/2,line=e.line+e.normal*.13,x=e.axis==='x'?line:t,z=e.axis==='x'?t:line;
   const room=rooms.find(r=>r.floor===floor&&contains(r,x,z));
   result.push({...e,a,b,floor,room:room?.id,color:wallPalette[room?.equipment]||wallPalette.access});
  }
 }
 return {caps:plan.caps,edges:result,trimEdges:plan.edges};
}

// Two substantial room-specific service assemblies per bay. Mount them on
// actual exposed wall faces, away from the existing central sign/extinguisher.
export function roomDetailAnchors(){
 const faces=['1','2'].flatMap(f=>finishedWallEdges(f).edges),result=[];
 for(const r of rooms){
  const station=roomStations.find(p=>p.waypoint===r.id),candidates=[];
  const depth=Math.max(...roomKits[r.id].map(k=>k==='safety'?.27:['parts','inventory'].includes(k)?.22:.20));
  for(const e of faces.filter(e=>e.room===r.id&&e.b-e.a>1.55)){
   const width=Math.min(1.65,e.b-e.a-.24),count=Math.max(1,Math.floor((e.b-e.a)/2.5));
   for(let i=0;i<count;i++){
    const t=e.a+(i+.5)*(e.b-e.a)/count,x=e.axis==='x'?e.line:t,z=e.axis==='x'?t:e.line;
    if(station&&Math.hypot(x-station.x,z-station.z)<width/2+1.05)continue;
    const bx=x+(e.axis==='x'?e.normal*depth/2:0),bz=z+(e.axis==='z'?e.normal*depth/2:0),bw=e.axis==='x'?depth:width,bd=e.axis==='x'?width:depth;
    if(obstacles.some(o=>o.type!=='wall'&&o.h>=.81&&o.floor===r.floor&&Math.abs(o.x-bx)<(o.w+bw)/2+.025&&Math.abs(o.z-bz)<(o.d+bd)/2+.025))continue;
    candidates.push({x,z,width,axis:e.axis,normal:e.normal,edge:e,distance:station?Math.hypot(x-station.x,z-station.z):0});
   }
  }
  candidates.sort((a,b)=>(b.edge.b-b.edge.a)-(a.edge.b-a.edge.a)||b.distance-a.distance);
  const picked=[];
  for(const c of candidates){if(picked.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<2.15))continue;picked.push(c);if(picked.length===2)break;}
  picked.forEach((p,i)=>result.push({...p,room:r.id,floor:r.floor,kit:roomKits[r.id][i],baseY:.79,topY:1.30,depth}));
 }
 return result;
}
