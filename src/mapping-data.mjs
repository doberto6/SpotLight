export function mappingData(data, {day, period, severity, review, scope, mission, location, asset}) {
  if (!data || !day) return {actions:[], anomalies:[], events:[]};
  const anchor=new Date(day+'T00:00:00Z'),start=new Date(anchor),end=new Date(anchor);
  if(period==='week'){start.setUTCDate(anchor.getUTCDate()-(anchor.getUTCDay()+6)%7);end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+6);}
  if(period==='month'){start.setUTCDate(1);end.setUTCMonth(anchor.getUTCMonth()+1,0);}
  if(period==='year'){start.setUTCMonth(0,1);end.setUTCMonth(11,31);}
  const from=start.toISOString().slice(0,10),to=end.toISOString().slice(0,10);
  const anomalies=data.anomalies.filter(a=>a.timestamp.slice(0,10)>=from&&a.timestamp.slice(0,10)<=to&&(severity==='all'||a.severity===severity)&&(!review||a.operator_review_required==='True')&&(scope==='all'||a.mission_id===mission)&&(location==='all'||a.location_id===location)&&(asset==='all'||a.asset_id===asset));
  const ids=new Set(anomalies.map(a=>a.action_id));
  const actions=data.actions.filter(a=>ids.has(a.action_id)).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.mission_id.localeCompare(b.mission_id)||Number(a.sequence)-Number(b.sequence));
  const events=data.events.filter(e=>ids.has(e.details?.action_id)).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.event_id.localeCompare(b.event_id));
  return {actions,anomalies,events};
}
