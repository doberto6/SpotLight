import React,{useMemo} from 'react';
import {bounds,obstacles,worldPoint} from './replay-engine.mjs';

export default function SpotMinimap({replay,pose,anomalies,selectedAnomaly,manual}) {
  const route=useMemo(()=>replay.segments.flatMap(s=>s.path).map(p=>`${p.x},${p.z}`).join(' '),[replay]);
  return <div className="spot-minimap">
    <div className="spot-minimap-heading"><strong>Spot tracking</strong><span>{manual?'Manual':'Replay'} · ▲ Spot</span></div>
    <svg viewBox="-43 -26 86 52" role="img" aria-label={`Facility minimap. Spot at X ${pose.x.toFixed(2)}, Z ${pose.z.toFixed(2)}.`}>
      <rect x={bounds.minX} y={bounds.minZ} width={bounds.maxX-bounds.minX} height={bounds.maxZ-bounds.minZ} rx="1" fill="#142b38" stroke="#547084" strokeWidth=".4"/>
      {obstacles.map((o,i)=><rect key={i} x={o.x-o.w/2} y={o.z-o.d/2} width={o.w} height={o.d} fill={o.type==='wall'?'#688395':'#385461'} stroke="#91a9b5" strokeWidth=".15"/>)}
      <polyline points={route} fill="none" stroke="#57c7de" strokeWidth=".45" opacity=".7"/>
      {anomalies.map(a=>{const p=worldPoint(a.location_id),selected=a.anomaly_id===selectedAnomaly?.anomaly_id;return <circle key={a.anomaly_id} cx={p.x} cy={p.z} r={selected?1.3:.7} fill={a.severity==='CRITICAL'?'#ff718b':'#ffc65e'} stroke={selected?'#fff':'none'} strokeWidth=".3"><title>{a.anomaly_id} · {a.location_id}</title></circle>;})}
      <g className="spot-minimap-marker" transform={`translate(${pose.x} ${pose.z}) rotate(${-pose.yaw*180/Math.PI})`}>
        <circle r="2.2" fill="#ffd45b" fillOpacity=".15"/>
        <path d="M 1.9 0 L -1.3 -1.1 L -.7 0 L -1.3 1.1 Z" fill="#ffd45b" stroke="#111d27" strokeWidth=".3"/>
      </g>
      <text x="39" y="-23.5" fill="#c6dce8" fontSize="2" textAnchor="end">N ↑</text>
    </svg>
  </div>;
}
