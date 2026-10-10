import {obstacles,bounds,floors,imageToWorld,floorAt} from './facility-layout.mjs';

// Boston Dynamics' supplied specification (updated 2024-05-22), metres.
// Clearance is a simulation choice, not a manufacturer safety certification.
export const SPOT_DIMENSIONS=Object.freeze({length:1.1,width:.5,walkingHeight:.61,maxSpeed:1.6});
export const SPOT_COLLISION=Object.freeze({length:1.15,width:.55,height:.73,clearance:.025,halfLength:.575,halfWidth:.275});
export const NAV_RADIUS=Math.hypot(SPOT_COLLISION.halfLength,SPOT_COLLISION.halfWidth)+.005;
const outlines=floors.map(f=>({id:f.id,points:f.outline.map(imageToWorld)}));
const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function footprintCorners(pose,extra=0){
 const c=Math.cos(pose.yaw||0),s=Math.sin(pose.yaw||0),l=SPOT_COLLISION.halfLength+extra,w=SPOT_COLLISION.halfWidth+extra;
 return [[-l,-w],[l,-w],[l,w],[-l,w]].map(([x,z])=>({x:pose.x+x*c+z*s,z:pose.z-x*s+z*c}));
}

// Four-axis SAT between the rotating robot rectangle and a registered obstacle.
// Extra extents conservatively cover translation/rotation between tested poses.
export function blockedPose(pose,solids=obstacles,extraLength=0,extraWidth=extraLength){
 const c=Math.cos(pose.yaw||0),s=Math.sin(pose.yaw||0),ac=Math.abs(c),as=Math.abs(s),l=SPOT_COLLISION.halfLength+extraLength,w=SPOT_COLLISION.halfWidth+extraWidth,ex=l*ac+w*as,ez=l*as+w*ac;
 if(pose.x-ex<bounds.minX||pose.x+ex>bounds.maxX||pose.z-ez<bounds.minZ||pose.z+ez>bounds.maxZ)return true;
 for(const o of solids){if((o.h??1)>0&&(o.baseY??0)>=SPOT_COLLISION.height)continue;
  const dx=o.x-pose.x,dz=o.z-pose.z,ox=o.w/2,oz=o.d/2;
  if(Math.abs(dx)>=ex+ox-1e-8||Math.abs(dz)>=ez+oz-1e-8)continue;
  if(Math.abs(dx*c-dz*s)>=l+ox*ac+oz*as-1e-8||Math.abs(dx*s+dz*c)>=w+ox*as+oz*ac-1e-8)continue;
  return true;
 }
 if(solids===obstacles){
  const floor=floorAt(pose.x,pose.z);if(!floor)return true;
  for(const [x,z] of [[-l,-w],[l,-w],[l,w],[-l,w]])if(floorAt(pose.x+x*c+z*s,pose.z-x*s+z*c)!==floor)return true;
  // Concave floor corners must not cut into a rectangle whose four corners fit.
  for(const p of outlines.find(f=>f.id===floor).points){const dx=p.x-pose.x,dz=p.z-pose.z;if(Math.abs(dx*c-dz*s)<l-1e-7&&Math.abs(dx*s+dz*c)<w-1e-7)return true;}
 }
 return false;
}

export function clearPoseSweep(from,to,solids=obstacles){
 const angle=deltaAngle(from.yaw||0,to.yaw||0),distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(Math.abs(angle)/.08),Math.ceil(distance/.15));
 if(blockedPose(from,solids)||blockedPose(to,solids))return false;
 for(let i=0;i<steps;i++){
  const t=(i+.5)/steps,yaw=(from.yaw||0)+angle*t,c=Math.cos(yaw),s=Math.sin(yaw),dx=(to.x-from.x)/steps,dz=(to.z-from.z)/steps;
  const turnMargin=2*Math.hypot(SPOT_COLLISION.halfLength,SPOT_COLLISION.halfWidth)*Math.sin(Math.abs(angle)/steps/4);
  if(blockedPose({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw},solids,Math.abs(dx*c-dz*s)/2+turnMargin,Math.abs(dx*s+dz*c)/2+turnMargin))return false;
 }
 return true;
}

export function clearFootprintSegment(a,b,solids=obstacles){
 const yaw=-Math.atan2(b.z-a.z,b.x-a.x);
 return clearPoseSweep({...a,yaw},{...b,yaw},solids);
}

// Used only when the wider, rotation-safe walking planner cannot find a route.
// Heading states allow a long robot to pass a narrow door without assuming it
// can rotate there. No collision search runs in an animation frame.
export function narrowRoute(from,to,solids=obstacles){
 const grid=.25,cell=p=>[Math.round(p.x/grid),Math.round(p.z/grid)],start=cell(from),end=cell(to),point=(x,z)=>({x:x*grid,z:z*grid}),directions=[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1]],yaw=h=>h*Math.PI/4,key=(x,z,h)=>x+','+z+','+h;
 const poseAt=(x,z)=>x===start[0]&&z===start[1]?from:x===end[0]&&z===end[1]?to:point(x,z);
 const open=[],cost=new Map(),parent=new Map(),closed=new Set();
 for(let h=0;h<8;h++){const k=key(...start,h),pose={...from,yaw:yaw(h)};if(!clearPoseSweep({...from,yaw:from.yaw??yaw(h)},pose,solids))continue;cost.set(k,0);open.push({x:start[0],z:start[1],h,k});}
 const estimate=p=>Math.hypot(p.x-end[0],p.z-end[1]);let expanded=0;
 while(open.length&&expanded++<100000){open.sort((a,b)=>(cost.get(b.k)+estimate(b))-(cost.get(a.k)+estimate(a)));const p=open.pop();if(closed.has(p.k))continue;closed.add(p.k);
  const current={...poseAt(p.x,p.z),yaw:yaw(p.h)};
  if(p.x===end[0]&&p.z===end[1]&&clearPoseSweep(current,{...to,yaw:to.yaw??yaw(p.h)},solids)){
   const nodes=[{...to,yaw:to.yaw??yaw(p.h)}];let k=p.k;while(parent.has(k)){const [x,z,h]=k.split(',').map(Number);nodes.push({...poseAt(x,z),yaw:yaw(h)});k=parent.get(k);}const initialYaw=yaw(Number(k.split(',')[2]));nodes.push({...from,yaw:initialYaw},{...from,yaw:from.yaw??initialYaw});nodes.reverse();return nodes;
  }
  const [dx,dz]=directions[p.h],candidates=[{x:p.x+dx,z:p.z+dz,h:p.h,weight:Math.hypot(dx,dz)},...[-1,1].map(d=>({x:p.x,z:p.z,h:(p.h+d+8)%8,weight:.45}))];
  for(const n of candidates){n.k=key(n.x,n.z,n.h);const c=cost.get(p.k)+n.weight;if(closed.has(n.k)||c>=(cost.get(n.k)??Infinity))continue;
   const destination={...poseAt(n.x,n.z),yaw:yaw(n.h)};if(!clearPoseSweep(current,destination,solids))continue;
   parent.set(n.k,p.k);cost.set(n.k,c);open.push(n);
  }
 }
 return [from];
}
