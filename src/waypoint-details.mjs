import {roomIdentity} from './room-fitout.mjs';
import {stamp} from './replay-engine.mjs';

const purposes={
 WP01:'Main access and safety equipment.',WP02:'Switchgear, local controls and an operator console.',
 WP03:'Cooling-water pumps, pressure vessels and service valves.',WP04:'Process pumps and standby pumping equipment.',
 WP05:'Steam pipe banks, isolation valves and maintenance access.',WP06:'Compressed-air equipment, filtration and drying.',
 WP07:'Connecting service corridor and emergency equipment.',WP08:'Turbine equipment and lubrication services.',
 WP09:'Generator equipment and auxiliary cooling.',WP10:'Local valve and pressure-service equipment.',
 WP11:'UPS cabinets, battery banks and communications.',WP12:'Heat-exchange equipment and circulation pumps.',
 WP13:'Spare parts, component bins and storage racks.',WP14:'Transformer and electrical distribution equipment.',
 WP15:'Maintenance benches, tools, carts and replacement parts.'
};
const rank={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};

// Evidence is scoped to the selected mission by the caller. Upcoming findings
// are kept separate, never presented as hazards already encountered by SPOT.
export function waypointDetails(location,{actions,readings,anomalies},assets,sourceTimestamp){
 if(!location)return null;
 const id=location.location_id,here=r=>r.location_id===id,ordered=actions.filter(here).sort((a,b)=>stamp(a.timestamp)-stamp(b.timestamp));
 const started=ordered.filter(a=>stamp(a.timestamp)<=sourceTimestamp),latest=started.at(-1)||null;
 const complete=a=>stamp(a.timestamp)+Number(a.duration_sec||0)*1000<=sourceTimestamp;
 const findings=anomalies.filter(here).sort((a,b)=>(rank[b.severity]||0)-(rank[a.severity]||0)||stamp(a.timestamp)-stamp(b.timestamp));
 const encountered=findings.filter(a=>stamp(a.timestamp)<=sourceTimestamp),upcoming=findings.filter(a=>stamp(a.timestamp)>sourceTimestamp);
 const failures=started.filter(a=>a.status==='FAILED'&&complete(a));
 const assetIds=new Set([...assets.filter(here),...ordered].map(a=>a.asset_id));
 const status=!latest?'Not visited at this replay time':!complete(latest)?(latest.action_type==='NAVIGATION'?'Visit in progress':'Inspection in progress'):latest.status==='FAILED'?'Inspection needs review':latest.action_type==='NAVIGATION'?'Visited':'Inspection completed';
 return {location,purpose:purposes[id]||'Industrial inspection waypoint.',precaution:roomIdentity[id]?.[1]||null,latest,status,encountered,upcoming,failures,
  readings:readings.filter(r=>here(r)&&r.action_id===latest?.action_id&&stamp(r.timestamp)<=sourceTimestamp),
  assets:[...assetIds].map(id=>assets.find(a=>a.asset_id===id)).filter(Boolean),
  reviewRequired:encountered.some(a=>String(a.operator_review_required).toLowerCase()==='true')||failures.length>0};
}
