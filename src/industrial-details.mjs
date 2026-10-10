import {rooms,obstacles,imageToWorld} from './facility-layout.mjs';

// One local service panel per operational bay, attached to a room-facing wall.
// Mounted above SPOT: these add no ground obstacles or changes to waypoint pins.
export const wallPanels=rooms.map(room=>{
 const a=imageToWorld(room.rect.slice(0,2)),b=imageToWorld(room.rect.slice(2)),cx=(a.x+b.x)/2,cz=(a.z+b.z)/2;
 const candidates=obstacles.filter(w=>w.type==='wall'&&w.floor===room.floor).flatMap(w=>{
  const horizontal=w.w>w.d,axis=horizontal?'z':'x',along=horizontal?'x':'z',half=(horizontal?w.w:w.d)/2;
  if(w[axis]<(horizontal?a.z:a.x)-.25||w[axis]>(horizontal?b.z:b.x)+.25)return [];
  const lo=Math.max(w[along]-half+.4,horizontal?a.x:a.z),hi=Math.min(w[along]+half-.4,horizontal?b.x:b.z);if(hi-lo<.6)return [];
  const side=(horizontal?cz:cx)>=w[axis]?1:-1,p={x:w.x,z:w.z};p[along]=Math.max(lo,Math.min(hi,horizontal?cx:cz));p[axis]+=side*((horizontal?w.d:w.w)/2+.086);
  return [{...p,wall:w,horizontal,side,distance:Math.hypot(p.x-cx,p.z-cz)}];
 }).sort((a,b)=>a.distance-b.distance);
 const p=candidates[0];return p?{...p,floor:room.floor,waypoint:room.id,y:1.65,size:[.48,.6,.16],yaw:p.horizontal?(p.side>0?0:Math.PI):(p.side>0?Math.PI/2:-Math.PI/2)}:null;
}).filter(Boolean);
