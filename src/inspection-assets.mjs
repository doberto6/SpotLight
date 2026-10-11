import {equipment,waypointFloor} from './facility-layout.mjs';
import {wallPanels} from './industrial-details.mjs';
import {stamp} from './replay-engine.mjs';

// Catalog locations and recorded action locations can differ in this synthetic
// kit. Preserve both: a target identifies an asset AND its inspection location.
export function inspectionTargets(assets,actions){
 const catalog=new Map(assets.map(a=>[a.asset_id,a])),pairs=new Map();
 for(const record of [...assets,...actions]){
  const asset=catalog.get(record.asset_id);if(!asset||!record.location_id)continue;
  const key=record.asset_id+'@'+record.location_id;pairs.set(key,{...asset,location_id:record.location_id,key});
 }
 const grouped=new Map();for(const a of pairs.values()){if(!grouped.has(a.location_id))grouped.set(a.location_id,[]);grouped.get(a.location_id).push(a);}
 return [...grouped].flatMap(([id,list])=>list.map((a,i)=>{
  const pad=equipment.find(o=>o.waypoint===id),wall=wallPanels.find(p=>p.waypoint===id);let position;
  if(pad)position=[pad.x-pad.w*.36+(list.length>1?pad.w*.72*i/(list.length-1):pad.w*.36),1.2,pad.z+pad.d/2-.025];
  else if(wall){const step=Math.min(.25,(Math.max(wall.wall.w,wall.wall.d)-.3)/Math.max(1,list.length));position=[wall.x+(wall.horizontal?(i-(list.length-1)/2)*step:0),1.08,wall.z+(wall.horizontal?0:(i-(list.length-1)/2)*step)];}
  return position?{...a,floor:waypointFloor(id),position,pad,wall:pad?null:wall}:null;
 })).filter(Boolean);
}

export function inspectionSnapshot(target,{actions,readings,anomalies},sourceTimestamp){
 const matching=r=>r.asset_id===target.asset_id&&r.location_id===target.location_id&&stamp(r.timestamp)<=sourceTimestamp;
 const action=actions.filter(matching).sort((a,b)=>stamp(a.timestamp)-stamp(b.timestamp)).at(-1)||null;
 const findings=anomalies.filter(matching),samples=readings.filter(r=>matching(r)&&r.action_id===action?.action_id);
 const finished=action&&stamp(action.timestamp)+Number(action.duration_sec||0)*1000<=sourceTimestamp;
 return {action,readings:samples,findings,status:findings.length?'finding':!action?'pending':!finished?'inspecting':action.status==='SUCCESS'?(action.action_type==='NAVIGATION'?'visited':'inspected'):'review'};
}
