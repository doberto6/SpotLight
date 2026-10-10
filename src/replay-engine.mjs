// Dataset timestamps have no timezone. UTC parsing preserves their relative spacing.
export const stamp = value => Date.parse(value.endsWith('Z') ? value : value + 'Z');
export const waypointPositions = {
  WP01:[10,76], WP02:[10.3,51.5], WP03:[23.2,38], WP04:[19.6,13.5],
  WP05:[40.8,36], WP06:[50.6,13.5], WP07:[60.6,46], WP08:[34.6,67.5],
  WP09:[50.3,67.5], WP10:[61.4,70], WP11:[77.5,21.5], WP12:[91.5,23],
  WP13:[76.4,53], WP14:[90.6,58], WP15:[81.8,79]
};
export function worldPoint(id) {
  const p=waypointPositions[id] || [50,50];
  return {x:(p[0]-50)*.8,z:(p[1]-50)*.45};
}
export const bounds={minX:-40,maxX:40,minZ:-22.5,maxZ:22.5};
// Illustrative partitions with wide doorway openings and an inter-floor passage.
export const obstacles=[
  {x:14.8,z:-13,w:.45,d:19,h:3.5,type:'wall'},
  {x:14.8,z:13,w:.45,d:19,h:3.5,type:'wall'},
  ...[-28,-12,4,26].flatMap(x=>[-16,16].map(z=>({x,z,w:3,d:2.4,h:2.5,type:'cabinet'}))),
  ...[-30,-10,8,28].flatMap(x=>[-10,10].map(z=>({x,z,w:7,d:.35,h:3.5,type:'wall'}))),
  {x:-35,z:0,w:2.5,d:4,h:2.4,type:'generator'},
  {x:34,z:0,w:2.5,d:4,h:2.4,type:'generator'}
];
export function blocked(x,z,solids=obstacles,radius=.65) {
  return x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius||
    solids.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
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

// A* through the same collision grid used by manual control.
export function routeBetween(from,to,solids=obstacles) {
  const cell=p=>[Math.round(p.x),Math.round(p.z)],key=([x,z])=>x+','+z;
  const start=cell(from),end=cell(to),open=[start],cost=new Map([[key(start),0]]),parents=new Map(),closed=new Set();
  const heuristic=p=>Math.abs(p[0]-end[0])+Math.abs(p[1]-end[1]);
  while(open.length){
    open.sort((a,b)=>(cost.get(key(b))+heuristic(b))-(cost.get(key(a))+heuristic(a)));
    const here=open.pop(),hk=key(here);if(closed.has(hk))continue;closed.add(hk);
    if(hk===key(end)){const path=[to];let k=hk;while(parents.has(k)){const p=k.split(',').map(Number);path.push({x:p[0],z:p[1]});k=parents.get(k);}path.push(from);return path.reverse();}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[here[0]+dx,here[1]+dz],nk=key(next),c=cost.get(hk)+1;
      if(blocked(...next,solids,.9)||closed.has(nk)||c>=(cost.get(nk)??Infinity))continue;parents.set(nk,hk);cost.set(nk,c);open.push(next);
    }
  }
  return [from]; // Stay in place when a destination cannot be reached safely.
}
export function buildReplay(mission,actions,events) {
  const start=stamp(mission.start_time),end=Math.max(start,stamp(mission.end_time));
  const visits=actions.filter(a=>waypointPositions[a.location_id]).map(a=>({...a,at:stamp(a.timestamp)-start,...worldPoint(a.location_id)})).sort((a,b)=>a.at-b.at||Number(a.sequence)-Number(b.sequence));
  const nodes=visits.length?[{...visits[0],at:0}]:[{at:0,x:0,z:0}];
  visits.forEach((visit,i)=>{
    nodes.push(visit);
    const dwellEnd=Math.min(visit.at+Number(visit.duration_sec||0)*1000,visits[i+1]?.at??end-start,end-start);
    if(dwellEnd>visit.at)nodes.push({...visit,at:dwellEnd});
  });
  const segments=nodes.slice(1).map((next,i)=>{const path=routeBetween(nodes[i],next);const distances=[0];for(let j=1;j<path.length;j++)distances.push(distances[j-1]+Math.hypot(path[j].x-path[j-1].x,path[j].z-path[j-1].z));return {path,distances,length:distances.at(-1)};});
  return {start,duration:(end-start)/1000,nodes,segments,events:events.map(e=>({...e,at:(stamp(e.timestamp)-start)/1000})).sort((a,b)=>a.at-b.at||a.event_id.localeCompare(b.event_id))};
}
export function sampleReplay(replay,seconds) {
  const t=Math.max(0,Math.min(seconds,replay.duration))*1000;let i=0;
  while(i+1<replay.nodes.length&&replay.nodes[i+1].at<=t)i++;
  const node=replay.nodes[i],next=replay.nodes[i+1],segment=replay.segments[i];
  if(!next||!segment?.length)return {x:node.x,z:node.z,yaw:0,speed:0,location_id:node.location_id};
  const span=Math.max(1,next.at-node.at),fraction=Math.max(0,Math.min(1,(t-node.at)/span)),distance=fraction*segment.length;
  let j=0;while(j+1<segment.distances.length-1&&segment.distances[j+1]<distance)j++;
  const a=segment.path[j],b=segment.path[j+1],length=segment.distances[j+1]-segment.distances[j],f=length?(distance-segment.distances[j])/length:0;
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:-Math.atan2(b.z-a.z,b.x-a.x),speed:segment.length/(span/1000),location_id:node.location_id};
}
export function initialReplayState(){return {mode:'replay',manual:false,playing:false,time:0,speed:1};}
export function replayReducer(state,action) {
  switch(action.type){
    case 'play':return {...state,manual:false,playing:true,time:state.time>=action.duration?0:state.time};
    case 'pause':return {...state,playing:false};
    case 'seek':return {...state,manual:false,playing:false,time:Math.max(0,Math.min(action.time,action.duration))};
    case 'takeover':return {...state,manual:true,playing:false};
    case 'stop':return {...state,playing:false};
    case 'return':return {...state,mode:'replay',manual:false,playing:false};
    case 'resume':return {...state,manual:false,playing:state.time<action.duration};
    case 'speed':return {...state,speed:action.speed};
    case 'mode':return {...state,mode:action.mode,manual:false,playing:false};
    case 'tick':if(!state.playing||state.manual)return state;return {...state,time:Math.min(action.duration,state.time+action.dt*state.speed),playing:state.time+action.dt*state.speed<action.duration};
    default:return state;
  }
}
