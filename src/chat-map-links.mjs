// Only link places supported by the answer's evidence and present on the map.
export function mapReferences(sources=[],locations=[]){
  const references=new Map();
  for(const source of sources){
    const record=source.record||{};
    const location=locations.find(l=>l.location_id===record.location_id);
    if(!location)continue;
    for(const text of [location.location_id,location.location_name,record.asset_id,record.asset_name]){
      if(text&&!references.has(text))references.set(text,{location_id:location.location_id,record});
    }
  }
  return references;
}

export function linkedMapText(text,references){
  if(!references.size)return [{text}];
  const names=[...references.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const expression=new RegExp(`(?<![\\w-])(${names.join('|')})(?![\\w-])`,'g');
  return text.split(expression).filter(Boolean).map(part=>({text:part,...references.get(part)}));
}

export function mapDestination(data,locationId,record={}){
  const location=data.locations.find(l=>l.location_id===locationId);
  if(!location)return null;
  const supporting=data.actions.find(a=>a.action_id===record.action_id&&a.location_id===locationId);
  const mission=data.missions.find(m=>m.mission_id===(record.mission_id||supporting?.mission_id));
  // Aggregate answers have no single mission; use the latest recorded visit.
  const latest=[...data.actions].filter(a=>a.location_id===locationId).sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)))[0];
  const date=String(record.timestamp||supporting?.timestamp||mission?.start_time||latest?.timestamp||'').slice(0,10);
  return {location,mission:mission?.mission_id,day:date};
}
