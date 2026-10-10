import React,{useMemo} from 'react';
import {worldToImage,waypointPositions,markerColor,waypointFloor} from './facility-layout.mjs';
// Match the source image while keeping the shared waypoint registration in percentages.
const MAP_HEIGHT=100*595/1095;
const mapPoint=pose=>{const [x,y]=worldToImage(pose);return [x,y*MAP_HEIGHT/100];};
export default function SpotMinimap({replay,pose,manual,floor='all',locations=[],selectedWaypoint,onSelect,showPath=true}){
  const [x,y]=worldToImage(pose);
  const guide=useMemo(()=>replay.segments.flatMap((s,i)=>s.transfer||s.unreachable||!s.length?[]:[{id:i,floor:waypointFloor(replay.nodes[i].location_id),points:s.path.map(p=>mapPoint(p).join(',')).join(' ')}]),[replay]);
  return <div className="spot-minimap"><div className="spot-minimap-heading"><strong>Floor-plan tracking</strong><span>{manual?'Manual simulation':'Estimated route'} · ▲ SPOT</span></div>
    <svg viewBox={`0 0 100 ${MAP_HEIGHT}`} width="1095" height="595" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Reference floor plan. SPOT on floor ${pose.floor||'1'} at image position ${x.toFixed(1)}, ${y.toFixed(1)}.`}>
      <image href="/kit-assets/fictional_floor_plan.png" width="100" height={MAP_HEIGHT} opacity=".65"/>
      {guide.map(s=><polyline key={s.id} points={s.points} style={{display:showPath&&(floor==='all'||floor===s.floor)?undefined:'none'}} fill="none" stroke="#fff" strokeWidth=".6" strokeDasharray=".35 .7"/>)}
      {locations.filter(l=>floor==='all'||l.floor===floor).map(l=>{const p=waypointPositions[l.location_id];return <g key={l.location_id} onClick={()=>onSelect?.(l.location_id)} className="spot-map-pin"><circle cx={p[0]} cy={p[1]*MAP_HEIGHT/100} r={selectedWaypoint===l.location_id?2.1:1.5} fill={markerColor(l.location_id,l.zone_type)} stroke="#fff" strokeWidth=".4"/><title>{l.location_id} · {l.location_name}</title></g>;})}
      {!pose.transfer&&(floor==='all'||floor===pose.floor)&&<g transform={`translate(${x} ${y*MAP_HEIGHT/100}) rotate(${-pose.yaw*180/Math.PI})`}><circle r="2.6" fill="#ffd45b" fillOpacity=".25"/><path d="M 2 0 L -1.4 -1.6 L -.7 0 L -1.4 1.6 Z" fill="#ffd45b" stroke="#18272e" strokeWidth=".35"/></g>}
    </svg></div>;
}
