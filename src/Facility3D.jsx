import React,{useMemo,useState,useEffect} from 'react';
import SpotReplayScene from './SpotReplayScene.jsx';
import {buildReplay,stamp} from './replay-engine.mjs';
import {inspectionMedia} from './inspection-media.mjs';
export {waypointPositions as waypointImagePositions} from './facility-layout.mjs';

// Mapping's event controls retain their source timestamps. The renderer, room
// geometry, collision mesh and registration are shared with Mission Replay.
export default function Facility3D({locations,actions,anomalies=[],events=[],replayIndex=0,replaySpeed=1,floor,current,selectedLocation,onSelect,motion=false,showLabels=true,simulation=false}){
  const [photos,setPhotos]=useState(true);
  const [cameraMode,setCameraMode]=useState('free'),[resetToken,setResetToken]=useState(0),[time,setTime]=useState(0),[roofMode,setRoofMode]=useState('cutaway'),[showPath,setShowPath]=useState(true);
  const replay=useMemo(()=>{
    const stamps=[...actions.map(a=>a.timestamp),...events.map(e=>e.timestamp)].filter(Boolean).sort();const start=stamps[0]||'2026-09-01T00:00:00',end=stamps.at(-1)||start;
    return buildReplay({start_time:start,end_time:end},actions,events);
  },[actions,events]);
  const target=events[replayIndex]?(stamp(events[replayIndex].timestamp)-replay.start)/1000:0;
  useEffect(()=>{if(!motion){setTime(target);return;}let id,last=performance.now();const frame=now=>{const dt=Math.min(.1,(now-last)/1000);last=now;setTime(t=>t+(target-t)*(1-Math.exp(-dt*5*replaySpeed)));id=requestAnimationFrame(frame);};id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);},[target,motion,replaySpeed,replay]);
  const visit=replay.visits.findLast(v=>v.at<=time*1000),photo=inspectionMedia(visit);
  return <div className="facility-3d clean-facility"><div className="facility-3d-canvas"><SpotReplayScene cameraResetToken={resetToken} roofMode={roofMode} showPath={showPath} overview replay={replay} locations={locations} anomalies={anomalies} state={{time,playing:motion,manual:false,recovering:false,speed:1}} cameraMode={cameraMode} floor={floor} stopToken={0} selectedLocation={selectedLocation||current} showLabels={showLabels} onSelect={onSelect} onAnomaly={a=>onSelect(locations.find(l=>l.location_id===a.location_id))} onTelemetry={()=>{}}/></div>
    <div className="map-instructions">Drag to orbit · Scroll to zoom · Select a waypoint</div><div className="map-reset"><select aria-label="Mapping camera" value={cameraMode} onChange={e=>setCameraMode(e.target.value)}><option value="free">Facility overview</option><option value="top">Top-down follow</option><option value="chase">Follow SPOT</option></select><select aria-label="Mapping roof" value={roofMode} onChange={e=>setRoofMode(e.target.value)}><option value="full">Full roof</option><option value="hidden">Hidden roof</option><option value="cutaway">Cutaway view</option><option value="overhead">Overhead navigation</option></select><label><input type="checkbox" checked={showPath} onChange={e=>setShowPath(e.target.checked)}/> Show Mission Path</label><button onClick={()=>setResetToken(n=>n+1)}>Reset view</button></div>{simulation&&<button className="photo-toggle" aria-pressed={photos} onClick={()=>setPhotos(!photos)}>{photos?'Hide sample imagery':'Show sample imagery'}</button>}{simulation&&photos&&photo&&<figure className="visit-photo" key={visit.action_id}><div><span>{visit.location_id} / {visit.action_id}</span><b className={visit.status==='FAILED'?'red':'green'}>{visit.status}</b></div><img src={photo.url} alt={photo.title}/><figcaption><b>{photo.title}</b><span>{photo.provenance}</span><small>Example imagery, not a capture from this action.</small></figcaption></figure>}<div className="map-key"><span>Image-registered estimated layout</span><span>● White dots · simulated route</span></div></div>;
}
