// Dataset timestamps have no timezone. UTC parsing preserves their relative spacing.
export const stamp = value => Date.parse(value.endsWith('Z') ? value : value + 'Z');
import {waypointPositions,worldPoint,bounds,obstacles,floorAt,waypointFloor} from './facility-layout.mjs';
export {waypointPositions,worldPoint,bounds,obstacles} from './facility-layout.mjs';
export function blocked(x,z,solids=obstacles,radius=.65) {
  return x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius||
    (solids===obstacles&&!floorAt(x,z))||solids.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
}
export function stepManual(pose,input,dt,solids=obstacles) {
  const step=Math.min(Math.max(dt,0),.05),target=input.stop?0:((input.forward||0)-(input.backward||0))*2.8;
  const speed=input.stop?0:pose.speed+(target-pose.speed)*(1-Math.exp(-step*7));
  const yaw=pose.yaw+((input.left||0)-(input.right||0))*step*1.5;
  const dx=Math.cos(yaw)*speed*step,dz=-Math.sin(yaw)*speed*step;
  let x=pose.x,z=pose.z,hit=false;
  if(!blocked(x+dx,z,solids))x+=dx;else hit=true;
  if(!blocked(x,z+dz,solids))z+=dz;else hit=true;
  return {...pose,x,z,yaw,speed:hit?0:speed,blocked:hit};
}
export function angleDelta(a,b) { return Math.atan2(Math.sin(b-a),Math.cos(b-a)); }

// A* and shortcut smoothing both validate the same robot clearance as manual control.
export function clearSegment(a,b,solids=obstacles,radius=.65){
  // Analytical segment/AABB intersection avoids slipping through a thin wall
  // between sample points, including on rounded corners.
  for(const o of solids){
    let low=0,high=1;
    for(const [axis,center,size] of [['x',o.x,o.w],['z',o.z,o.d]]){
      const min=center-size/2-radius+.00001,max=center+size/2+radius-.00001,d=b[axis]-a[axis];
      if(Math.abs(d)<1e-10){if(a[axis]<=min||a[axis]>=max){low=2;break;}}
      else {const u=(min-a[axis])/d,v=(max-a[axis])/d;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));}
    }
    if(low<=high)return false;
  }
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.1));
  for(let i=0;i<=n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,solids,radius))return false;
  return true;
}
export function routeBetween(from,to,solids=obstacles) {
  if(solids===obstacles&&floorAt(from.x,from.z)!==floorAt(to.x,to.z))return [from];
  if(clearSegment(from,to,solids))return [from,to];
  const grid=.4,cell=p=>[Math.round(p.x/grid),Math.round(p.z/grid)],key=([x,z])=>x+','+z,point=c=>({x:c[0]*grid,z:c[1]*grid});
  const start=cell(from),end=cell(to),open=[start],cost=new Map([[key(start),0]]),parents=new Map(),closed=new Set();
  const heuristic=p=>Math.hypot(p[0]-end[0],p[1]-end[1]);
  while(open.length){
    open.sort((a,b)=>(cost.get(key(b))+heuristic(b))-(cost.get(key(a))+heuristic(a)));
    const here=open.pop(),hk=key(here);if(closed.has(hk))continue;closed.add(hk);
    if(hk===key(end)){
      const path=[to];let k=hk;while(parents.has(k)){path.push(point(k.split(',').map(Number)));k=parents.get(k);}path.push(from);path.reverse();
      const result=[from];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!clearSegment(path[i],path[j],solids))j--;result.push(path[j]);i=j;}
      return roundCorners(result,solids);
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const next=[here[0]+dx,here[1]+dz],nk=key(next),c=cost.get(hk)+Math.hypot(dx,dz);
      if(closed.has(nk)||c>=(cost.get(nk)??Infinity)||!clearSegment(hk===key(start)?from:point(here),nk===key(end)?to:point(next),solids))continue;
      parents.set(nk,hk);cost.set(nk,c);open.push(next);
    }
  }
  return [from]; // Unreachable: expose it; never draw a line through a wall.
}
function roundCorners(path,solids){
  const result=[path[0]];
  for(let i=1;i<path.length-1;i++){
    const a=path[i-1],b=path[i],c=path[i+1],ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z),r=Math.min(.5,ab*.25,bc*.25);
    if(ab<.001||bc<.001){result.push(b);continue;}
    const entry={x:b.x+(a.x-b.x)*r/ab,z:b.z+(a.z-b.z)*r/ab},exit={x:b.x+(c.x-b.x)*r/bc,z:b.z+(c.z-b.z)*r/bc};
    const curve=Array.from({length:7},(_,j)=>{const f=j/6;return {x:(1-f)**2*entry.x+2*(1-f)*f*b.x+f*f*exit.x,z:(1-f)**2*entry.z+2*(1-f)*f*b.z+f*f*exit.z};});
    if(curve.every((p,j)=>clearSegment(j?curve[j-1]:result.at(-1),p,solids)))result.push(...curve);else result.push(b);
  }
  result.push(path.at(-1));return result.every((p,i)=>!i||clearSegment(result[i-1],p,solids))?result:path;
}
const recordedRoutes=new Map();
export function pathMetrics(path){const distances=[0];for(let j=1;j<path.length;j++)distances.push(distances[j-1]+Math.hypot(path[j].x-path[j-1].x,path[j].z-path[j-1].z));return {path,distances,length:distances.at(-1)};}
export function pointOnPath(segment,distance){
  let j=0;while(j+1<segment.distances.length-1&&segment.distances[j+1]<distance)j++;
  const a=segment.path[j],b=segment.path[Math.min(j+1,segment.path.length-1)],length=(segment.distances[j+1]||0)-segment.distances[j],f=length?Math.min(1,Math.max(0,(distance-segment.distances[j])/length)):0;
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:-Math.atan2(b.z-a.z,b.x-a.x)};
}
export function dottedPath(segment,spacing=.55){const dots=[];for(let d=0;d<segment.length;d+=spacing)dots.push({...pointOnPath(segment,d),distance:d});return dots;}
export function activeSegment(replay,seconds){let i=0;while(i+1<replay.nodes.length&&replay.nodes[i+1].at<=seconds*1000+.00001)i++;return i;}
export function nextVisit(replay,seconds){return replay.visits.find(v=>v.at>seconds*1000);}

export function buildReplay(mission,actions,events) {
  const start=stamp(mission.start_time),end=Math.max(start,stamp(mission.end_time));
  const visits=actions.filter(a=>waypointPositions[a.location_id]).map(a=>({...a,at:stamp(a.timestamp)-start,...worldPoint(a.location_id)})).sort((a,b)=>a.at-b.at||Number(a.sequence)-Number(b.sequence));
  const nodes=visits.length?[{...visits[0],at:0}]:[{at:0,x:0,z:0}];
  visits.forEach((visit,i)=>{
    nodes.push(visit);
    const dwellEnd=Math.min(visit.at+Number(visit.duration_sec||0)*1000,visits[i+1]?.at??end-start,end-start);
    if(dwellEnd>visit.at)nodes.push({...visit,at:dwellEnd});
  });
  const segments=nodes.slice(1).map((next,i)=>{const key=nodes[i].location_id+':'+next.location_id;if(!recordedRoutes.has(key))recordedRoutes.set(key,routeBetween(nodes[i],next));const path=recordedRoutes.get(key);const distances=[0];for(let j=1;j<path.length;j++)distances.push(distances[j-1]+Math.hypot(path[j].x-path[j-1].x,path[j].z-path[j-1].z));return {path,distances,length:distances.at(-1),transfer:waypointFloor(nodes[i].location_id)!==waypointFloor(next.location_id),unreachable:Math.hypot(path.at(-1).x-next.x,path.at(-1).z-next.z)>.01};});
  return {visits,start,duration:(end-start)/1000,nodes,segments,events:events.map(e=>({...e,at:(stamp(e.timestamp)-start)/1000})).sort((a,b)=>a.at-b.at||a.event_id.localeCompare(b.event_id))};
}
export function sampleReplay(replay,seconds) {
  const t=Math.max(0,Math.min(seconds,replay.duration))*1000;let i=0;
  while(i+1<replay.nodes.length&&replay.nodes[i+1].at<=t+.00001)i++;
  const node=replay.nodes[i],next=replay.nodes[i+1],segment=replay.segments[i];
  if(!next||!segment?.length)return {x:node.x,z:node.z,yaw:0,speed:0,location_id:node.location_id,floor:waypointFloor(node.location_id),transfer:!!segment?.transfer,destination:next?.location_id};
  const span=Math.max(1,next.at-node.at),fraction=Math.max(0,Math.min(1,(t-node.at)/span)),distance=(replay.demo?fraction*fraction*(3-2*fraction):fraction)*segment.length;
  let j=0;while(j+1<segment.distances.length-1&&segment.distances[j+1]<distance)j++;
  const a=segment.path[j],b=segment.path[j+1],length=segment.distances[j+1]-segment.distances[j],f=length?(distance-segment.distances[j])/length:0;
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:-Math.atan2(b.z-a.z,b.x-a.x),speed:segment.length/(span/1000),location_id:node.location_id,floor:waypointFloor(node.location_id),destination:next.location_id,transfer:!!segment?.transfer};
}
export function initialReplayState(){return {mode:'demo',manual:false,playing:false,recovering:false,time:0,speed:1};}
export function replayReducer(state,action) {
  switch(action.type){
    case 'play':return {...state,manual:false,playing:true,time:state.time>=action.duration?0:state.time};
    case 'pause':return {...state,playing:false};
    case 'seek':return {...state,recovering:false,manual:false,playing:false,time:Math.max(0,Math.min(action.time,action.duration))};
    case 'takeover':return {...state,recovering:false,manual:true,playing:false};
    case 'stop':return {...state,playing:false};
    case 'return':return {...state,recovering:false,mode:'replay',manual:false,playing:false,time:action.time??state.time};
    case 'resume':return {...state,recovering:true,manual:false,playing:state.time<action.duration};
    case 'speed':return {...state,speed:action.speed};
    case 'mode':return {...state,mode:action.mode,time:0,recovering:false,manual:false,playing:false};
    case 'recovered':return {...state,recovering:false,time:action.time??state.time,playing:action.error?false:state.playing};
    case 'tick':if(!state.playing||state.manual||state.recovering)return state;return {...state,time:Math.min(action.duration,state.time+action.dt*state.speed),playing:state.time+action.dt*state.speed<action.duration};
    default:return state;
  }
}
// Manual resume follows a fresh path while source time remains paused.
export function recoveryRoute(replay,seconds,pose){
  const active=replay.visits.find(v=>v.at<=seconds*1000&&(v.doneAt??v.at+Number(v.duration_sec||0)*1000)>seconds*1000);
  const visit=active||nextVisit(replay,seconds);if(!visit)return null;
  const path=routeBetween(pose,visit),metrics=pathMetrics(path);
  return {...metrics,visit,time:active?seconds:visit.at/1000,transfer:floorAt(pose.x,pose.z)!==waypointFloor(visit.location_id),unreachable:Math.hypot(path.at(-1).x-visit.x,path.at(-1).z-visit.z)>.01};
}

// Simulation timing uses estimated metres and a 1.5 m/s walk. Source records keep
// their original timestamps; this mapping drives evidence without inventing data.
export function buildSimulation(recorded){
  const nodes=recorded.nodes.map(n=>({...n,sourceAt:n.at}));nodes[0].at=0;
  for(let i=1;i<nodes.length;i++){const seg=recorded.segments[i-1],sourceSpan=(nodes[i].sourceAt-nodes[i-1].sourceAt)/1000;const seconds=seg.transfer?10:seg.length?seg.length/1.5:Math.min(30,Math.max(1,sourceSpan));nodes[i].at=nodes[i-1].at+seconds*1000;}
  const visits=recorded.visits.map(v=>{const i=recorded.nodes.findIndex((n,j)=>j>0&&n.action_id===v.action_id&&n.at===v.at);return {...v,sourceAt:v.at,at:nodes[i].at,doneAt:nodes[i+1]?.location_id===v.location_id?nodes[i+1].at:nodes[i].at};});
  const result={...recorded,nodes,visits,simulation:true,duration:nodes.at(-1).at/1000};
  result.events=recorded.events.map(e=>({...e,sourceAt:e.at,at:timelineTime(result,e.at)}));return result;
}

// Retiming only: the dataset, route paths and source timestamps are immutable.
// Allocate presentation time to every inspection, especially recorded findings;
// travel and long idle windows get a smaller budget than evidence holds.
export function buildDemo(recorded,anomalies=[],target=75){
  const originals=[...recorded.nodes],segments=[...recorded.segments];
  if(originals.at(-1).at<recorded.duration*1000){originals.push({...originals.at(-1),at:recorded.duration*1000});segments.push({...pathMetrics([originals.at(-1)]),transfer:false,unreachable:false});}
  const weights=segments.map((seg,i)=>{const span=(originals[i+1].at-originals[i].at)/1000;if(span<=0)return 0;const evidence=anomalies.filter(a=>stamp(a.timestamp)-recorded.start>=originals[i].at&&stamp(a.timestamp)-recorded.start<=originals[i+1].at).length;if(seg.transfer)return 1.2;if(seg.length)return Math.min(3.8,1.1+Math.sqrt(seg.length)*.22);const inspection=recorded.visits.some(v=>v.at===originals[i].at&&Number(v.duration_sec)>0);return inspection?(2.3+evidence*1.5):(.35+evidence*1.5);});
  const sum=weights.reduce((a,b)=>a+b,0)||1,nodes=originals.map(n=>({...n,sourceAt:n.at}));nodes[0].at=0;
  for(let i=1;i<nodes.length;i++)nodes[i].at=nodes[i-1].at+weights[i-1]/sum*target*1000;
  if(nodes.length>1)nodes.at(-1).at=target*1000;
  const result={...recorded,nodes,segments,simulation:true,demo:true,duration:nodes.length>1?target:0};
  result.visits=recorded.visits.map(v=>({...v,sourceAt:v.at,at:timelineTime(result,v.at/1000)*1000,doneAt:timelineTime(result,Math.min(recorded.duration,v.at/1000+Number(v.duration_sec||0)))*1000}));
  result.events=recorded.events.map(e=>({...e,sourceAt:e.at,at:timelineTime(result,e.at)}));
  result.findings=anomalies.map(a=>({...a,sourceAt:(stamp(a.timestamp)-recorded.start)/1000,at:timelineTime(result,(stamp(a.timestamp)-recorded.start)/1000)})).sort((a,b)=>a.at-b.at||a.anomaly_id.localeCompare(b.anomaly_id));
  return result;
}
export function sourceTime(replay,seconds){
  if(!replay.simulation)return seconds;const i=activeSegment(replay,seconds),a=replay.nodes[i],b=replay.nodes[i+1];if(!b)return a.sourceAt/1000;
  const f=Math.max(0,Math.min(1,(seconds*1000-a.at)/Math.max(1,b.at-a.at)));return (a.sourceAt+(b.sourceAt-a.sourceAt)*f)/1000;
}
export function timelineTime(replay,sourceSeconds){
  if(!replay.simulation)return sourceSeconds;const t=sourceSeconds*1000;let i=0;while(i+1<replay.nodes.length&&replay.nodes[i+1].sourceAt<=t)i++;const a=replay.nodes[i],b=replay.nodes[i+1];if(!b)return a.at/1000;
  return (a.at+(b.at-a.at)*Math.max(0,Math.min(1,(t-a.sourceAt)/Math.max(1,b.sourceAt-a.sourceAt))))/1000;
}
