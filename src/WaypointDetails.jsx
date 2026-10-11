import React,{useEffect,useRef} from 'react';

const human=value=>String(value||'').replaceAll('_',' ').toLowerCase();
export default function WaypointDetails({details,missionId,onClose,onFinding,onInspect}){
 const closeRef=useRef(null);
 useEffect(()=>{closeRef.current?.focus({preventScroll:true});},[]);
 const {location,purpose,precaution,status,latest,readings,encountered,upcoming,failures,assets,reviewRequired}=details;
 const finding=(a,upcoming=false)=><li key={a.anomaly_id} className="spot-waypoint-concern"><div><span className={'severity '+a.severity}>{a.severity}</span>{a.operator_review_required==='True'&&<span className="muted">Review required</span>}</div><strong>{human(a.anomaly_type)}</strong><p>{a.description}</p><small>{a.asset_id} · {a.timestamp.replace('T',' · ')}</small><button type="button" onClick={()=>onFinding(a)}>{upcoming?'Jump to recorded finding':'View recorded finding'}</button></li>;
 return <section className="spot-waypoint-details" aria-labelledby="spot-waypoint-details-title">
  <div className="spot-waypoint-details-head"><div><small>WAYPOINT DETAILS</small><h2 id="spot-waypoint-details-title">{location.location_id} · {location.location_name}</h2></div><button type="button" ref={closeRef} className="spot-waypoint-close" aria-label="Close waypoint details" onClick={onClose}>×</button></div>
  <p className="muted">Floor {location.floor} · {human(location.zone_type)} · {missionId}</p><p>{purpose}</p>{location.environment&&<p className="muted">Recorded environment: {human(location.environment)}</p>}
  {precaution&&<div className="spot-waypoint-precaution"><strong>Room precaution</strong><span>{human(precaution)}</span><small>Simulated room signage</small></div>}
  <h3>Recorded concerns</h3><p className="spot-waypoint-status">{status}{reviewRequired?' · Review needed':''}</p>
  {encountered.length?<ul className="spot-waypoint-concerns">{encountered.map(a=>finding(a))}</ul>:<p className="muted">{upcoming.length?'No concerns encountered at this replay time.':'No anomalies recorded here in this mission.'}</p>}
  {failures.length>0&&<div className="spot-waypoint-failures"><strong>Inspection concerns</strong>{failures.map(a=><div key={a.action_id}><p>{human(a.failure_type)||'Failed inspection'} · {a.asset_id}</p><small>{a.timestamp.replace('T',' · ')}</small><button type="button" onClick={()=>onInspect(a)}>View recorded action</button></div>)}</div>}
  {upcoming.length>0&&<details className="spot-waypoint-upcoming"><summary>Later in this recording · {upcoming.length} {upcoming.length===1?'finding':'findings'}</summary><ul className="spot-waypoint-concerns">{upcoming.map(a=>finding(a,true))}</ul></details>}
  {latest&&<details className="spot-waypoint-upcoming"><summary>Latest recorded visit · {latest.asset_id}</summary><p>{human(latest.action_type)} · {latest.timestamp.replace('T',' · ')}</p>{readings.map(r=><div className="spot-waypoint-reading" key={r.reading_id}><span>{human(r.measurement_type)}</span><strong>{r.value} {r.unit}</strong><small>{r.quality} · {r.timestamp.replace('T',' · ')}</small></div>)}{!readings.length&&<p className="muted">No readings available at this replay time.</p>}</details>}
  {assets.length>0&&<><h3>Equipment</h3><ul className="spot-waypoint-equipment">{assets.map(a=><li key={a.asset_id}><strong>{a.asset_id}</strong><span>{a.asset_name}</span></li>)}</ul></>}
  <p className="spot-waypoint-source">Recorded synthetic mission data · findings shown for this mission and replay time.</p>
 </section>;
}
