import {obstacles,rooms,equipment,floorAt} from './facility-layout.mjs';
import {wallPanels} from './industrial-details.mjs';

export const roomIdentity={
 WP01:['ACCESS / SAFETY','PEDESTRIAN ACCESS','#538d85'],WP02:['SWITCHGEAR','ELECTRICAL HAZARD','#ba9a46'],
 WP03:['COOLING WATER','PRESSURISED SYSTEM','#588e97'],WP04:['PROCESS PUMPS','ROTATING EQUIPMENT','#588e97'],
 WP05:['STEAM SERVICES','HOT SURFACES','#ba9a46'],WP06:['COMPRESSED AIR','HEARING PROTECTION','#5d8095'],
 WP07:['SERVICE CORRIDOR','KEEP ACCESS CLEAR','#538d85'],WP08:['TURBINE A','HEARING PROTECTION','#688496'],
 WP09:['GENERATOR B','ROTATING EQUIPMENT','#688496'],WP10:['VALVE STATION','PRESSURISED SYSTEM','#588e97'],
 WP11:['UPS / BATTERIES','ELECTRICAL HAZARD','#ba9a46'],WP12:['HEAT EXCHANGE','HOT SURFACES','#588e97'],
 WP13:['SPARES STORE','KEEP AISLES CLEAR','#8a8568'],WP14:['TRANSFORMER','ELECTRICAL HAZARD','#ba9a46'],
 WP15:['MAINTENANCE','EYE PROTECTION','#538d85']
};
// Fixtures hang above the complete walking envelope and on an existing wall face.
export const roomStations=wallPanels.map(p=>({...p,identity:roomIdentity[p.waypoint],width:Math.min(1.3,Math.max(p.wall.w,p.wall.d)-.16),baseY:.79}));

// Frame only actual gaps between collinear wall segments. Jambs fit inside the
// existing walls; lintels are overhead. No closed leaf or new floor obstacle.
export function doorOpenings(){
 const lines=new Map(),result=[];
 for(const w of obstacles.filter(o=>o.type==='wall')){
  const horizontal=w.w>w.d,along=horizontal?'x':'z',axis=horizontal?'z':'x',key=[w.floor,horizontal,w[axis].toFixed(4)].join(':');
  if(!lines.has(key))lines.set(key,[]);lines.get(key).push({w,horizontal,lo:w[along]-w[along==='x'?'w':'d']/2,hi:w[along]+w[along==='x'?'w':'d']/2});
 }
 for(const walls of lines.values()){
  walls.sort((a,b)=>a.lo-b.lo);
  for(let i=1;i<walls.length;i++){
   const a=walls[i-1],b=walls[i],width=b.lo-a.hi;if(width<1||width>4.4)continue;
   const along=(a.hi+b.lo)/2,p={x:a.horizontal?along:a.w.x,z:a.horizontal?a.w.z:along};
   if(floorAt(p.x,p.z)!==a.w.floor)continue;
   result.push({...p,width,horizontal:a.horizontal,floor:a.w.floor,walls:[a.w,b.w],baseY:2.3});
  }
 }
 return result;
}
export const workshop=equipment.find(o=>o.asset==='dock');
export const turbineBays=rooms.filter(r=>r.equipment==='turbine_generator');
