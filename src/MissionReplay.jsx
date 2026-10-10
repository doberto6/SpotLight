import React,{useMemo,useReducer,useEffect,useState,useRef} from 'react';
import SpotReplayScene from './SpotReplayScene.jsx';
import SpotMinimap from './SpotMinimap.jsx';
import {buildReplay,initialReplayState,replayReducer,stamp,sampleReplay} from './replay-engine.mjs';
import './mission-replay.css';
import {industrialCredits} from './industrial-credits.mjs';

const human=s=>String(s||'').replaceAll('_',' ').toLowerCase();
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export default function MissionReplay({data,mission,initialTimestamp,onInspect}) {
  const actions=useMemo(()=>data.actions.filter(a=>a.mission_id===mission.mission_id),[data,mission]);
  const events=useMemo(()=>data.events.filter(e=>e.mission_id===mission.mission_id),[data,mission]);
  const anomalies=useMemo(()=>data.anomalies.filter(a=>a.mission_id===mission.mission_id).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)),[data,mission]);
  const replay=useMemo(()=>buildReplay(mission,actions,events),[mission,actions,events]);
  const [state,dispatch]=useReducer(replayReducer,undefined,initialReplayState),[cameraMode,setCameraMode]=useState('chase'),[selectedAnomaly,setSelectedAnomaly]=useState(null),[pose,setPose]=useState(()=>sampleReplay(replay,0)),[stopToken,setStopToken]=useState(0);
  const lastTime=useRef(0);
  const simulationRef=useRef(null),[fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');
  useEffect(()=>{const update=()=>setFullscreen(document.fullscreenElement===simulationRef.current);document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);},[]);
  const toggleFullscreen=async()=>{setFullscreenError('');try{if(document.fullscreenElement===simulationRef.current)await document.exitFullscreen();else await simulationRef.current.requestFullscreen();}catch{setFullscreenError('Fullscreen unavailable in this browser. Try opening the app in a separate browser tab.');}};
  useEffect(()=>{if(initialTimestamp)dispatch({type:'seek',time:(stamp(initialTimestamp)-replay.start)/1000,duration:replay.duration});},[initialTimestamp,replay]);
  useEffect(()=>{
    if(!state.playing||state.manual)return;let id;lastTime.current=performance.now();
    const tick=now=>{const dt=Math.min((now-lastTime.current)/1000,.1);lastTime.current=now;dispatch({type:'tick',dt,duration:replay.duration});id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);
  },[state.playing,state.manual,replay.duration]);
  const seek=t=>{setStopToken(n=>n+1);dispatch({type:'seek',time:t,duration:replay.duration});};
  const selectAnomaly=a=>{setSelectedAnomaly(a);seek((stamp(a.timestamp)-replay.start)/1000);};
  const takeover=()=>{dispatch({type:'takeover'});setCameraMode('chase');};
  const timestamp=new Date(replay.start+state.time*1000).toISOString().slice(0,19);
  const currentEvent=[...replay.events].reverse().find(e=>e.at<=state.time);
  const currentAction=[...actions].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).find(a=>stamp(a.timestamp)<=replay.start+state.time*1000);
  const activeReadings=data.readings.filter(r=>r.action_id===(selectedAnomaly?.action_id||currentAction?.action_id));
  const battery=currentEvent?.details.battery_pct??currentAction?.battery_pct??mission.start_battery_pct;
  return <div className="spot-replay-workspace">
    <div className="spot-replay-main">
      <div className="spot-simulation-stage" ref={simulationRef}>
      <section className="panel spot-simulation-panel">
        <div className="panel-head"><div><small>SIMULATION ONLY</small><h2>Spot mission simulator</h2></div><span className={'badge '+(state.manual?'manual-badge':'')}>{state.manual?'Manual simulation active':state.mode==='replay'?'Historical replay':'Automated simulation'}</span></div>
        <div className="spot-viewport">
          <SpotReplayScene replay={replay} locations={data.locations} anomalies={anomalies} state={state} cameraMode={cameraMode} stopToken={stopToken} selectedAnomaly={selectedAnomaly} onAnomaly={selectAnomaly} onTelemetry={setPose}/>
          <div className="spot-viewport-tools"><label className="sr-only" htmlFor="spot-camera">Camera mode</label><select id="spot-camera" value={cameraMode} onChange={e=>setCameraMode(e.target.value)}><option value="chase">Third-person chase</option><option value="free">Free camera</option><option value="top">Top-down</option><option value="first">Robot perspective</option></select><button className="primary" onClick={takeover} disabled={state.manual}>Take Control</button><button onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen?'Exit fullscreen':'Fullscreen'}</button></div>
          <div className="spot-viewport-hint">{state.manual?'Click the map · W/S move · A/D turn · Arrows also work · Space stops':'Drag to orbit · Scroll to zoom · Select a finding marker'}</div>
          <SpotMinimap replay={replay} pose={pose} anomalies={anomalies} selectedAnomaly={selectedAnomaly} manual={state.manual}/>
        </div>
        {fullscreenError&&<p className="spot-source-note" role="status">{fullscreenError}</p>}
        <p className="spot-source-note">Reuses the Mapping Spot model. Movement interpolates recorded waypoint visits through illustrative plant geometry; coordinates are schematic. No physical robot connection.</p>
        <details className="industrial-credits"><summary>Industrial model credits</summary><p>Provided models identify CC BY 4.0 in their embedded metadata. Components were extracted, textures resized, and placement and scale adjusted.</p>{industrialCredits.map(asset=><div key={asset.file}><a href={asset.source} target="_blank" rel="noreferrer">{asset.title}</a><span> · {asset.author.split(' (')[0]} · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></span></div>)}</details>
      </section>
      <section className="panel spot-playback">
        <div className="panel-head"><div><small>MISSION TIMELINE</small><h2>{state.manual?'Manual branch · recording paused':'Follow the mission'}</h2></div><span className="muted">{timestamp.replace('T',' · ')} · source time</span></div>
        <div className="spot-mode-controls"><label>Operating mode<select value={state.mode} onChange={e=>{setStopToken(n=>n+1);dispatch({type:'mode',mode:e.target.value});}}><option value="replay">Replay recorded mission</option><option value="simulation">Automated simulation · recorded route</option></select></label><span className="muted">{state.mode==='simulation'?'Simulated movement; mission records remain historical.':'Manual takeover preserves the paused recording.'}</span></div>
        <div className="spot-playback-buttons"><button onClick={()=>seek(0)} disabled={state.manual}>↤ Start</button><button onClick={()=>seek(state.time-10)} disabled={state.manual}>−10s</button><button className="primary" disabled={state.manual||!replay.duration} onClick={()=>dispatch({type:state.playing?'pause':'play',duration:replay.duration})}>{state.playing?'Ⅱ Pause':'▶ Play'}</button><button onClick={()=>seek(state.time+10)} disabled={state.manual}>+10s</button><label>Speed<select aria-label="Mission replay speed" value={state.speed} onChange={e=>dispatch({type:'speed',speed:Number(e.target.value)})}>{[.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</select></label></div>
        <input className="spot-timeline" aria-label="Mission timestamp" type="range" min="0" max={replay.duration} step=".1" value={state.time} disabled={state.manual} onChange={e=>seek(Number(e.target.value))}/>
        <div className="spot-timeline-labels"><span>{clock(state.time)}</span><span>{clock(replay.duration)}</span></div>
        <div className="spot-manual-buttons"><button onClick={()=>{setStopToken(n=>n+1);dispatch({type:'stop'});}}>Stop</button><button disabled={!state.manual} onClick={()=>{setStopToken(n=>n+1);dispatch({type:'resume',duration:replay.duration});}}>Resume Mission</button><button disabled={!state.manual} onClick={()=>{setStopToken(n=>n+1);dispatch({type:'return'});}}>Return to Replay</button></div>
        {state.manual&&<p className="manual-instructions">Manual controls move a simulated Spot from this timestamp. Return to Replay restores the recorded position; Resume Mission restores it and continues playback.</p>}
      </section>
      </div>
      <details className="panel spot-event-list"><summary>Mission events · {events.length}</summary>{replay.events.map(e=><button className="record-row" key={e.event_id} onClick={()=>seek(e.at)}><span>{e.timestamp.split('T')[1]} · {human(e.event_type)}</span><span>{e.details.action_id||e.event_id}</span></button>)}</details>
    </div>
    <aside className="spot-replay-sidebar">
      <section className="panel"><small>SPOT STATUS</small><h2>{mission.mission_id} · {state.manual?'Manual':pose.walking?'Walking':'Standing'}</h2><dl className="spot-telemetry"><dt>Battery (recorded)</dt><dd>{battery}%</dd><dt>Mission outcome</dt><dd>{human(mission.mission_status)}</dd><dt>Scene X / Z</dt><dd>{pose.x.toFixed(2)} / {pose.z.toFixed(2)}</dd><dt>Heading</dt><dd>{(pose.yaw*180/Math.PI).toFixed(0)}°</dd><dt>Waypoint</dt><dd>{pose.location_id||'—'}</dd><dt>Event</dt><dd>{human(currentEvent?.event_type)||'Awaiting event'}</dd><dt>Position source</dt><dd>{state.manual?'Manual simulation':'Waypoint interpolation'}</dd></dl>{pose.blocked&&state.manual&&<p className="amber" role="status">Obstacle detected · movement stopped</p>}</section>
      <section className="panel"><div className="panel-head"><div><small>MISSION FINDINGS</small><h2>Anomalies <span className="muted">{anomalies.length}</span></h2></div></div><p className="muted">Select a finding to jump to its recorded timestamp.</p><div className="spot-findings">{anomalies.map(a=><button key={a.anomaly_id} className={'queue-item '+(selectedAnomaly?.anomaly_id===a.anomaly_id?'selected':'')} aria-pressed={selectedAnomaly?.anomaly_id===a.anomaly_id} onClick={()=>selectAnomaly(a)}><div><span className={'severity '+a.severity}>{a.severity}</span><span className="muted">{a.timestamp.split('T')[1]}</span></div><b>{human(a.anomaly_type)}</b><span>{a.location_id} · {a.asset_id}</span><small>{stamp(a.timestamp)>replay.start+state.time*1000?'Upcoming':'Encountered'}{a.operator_review_required==='True'?' · Review required':''}</small></button>)}{!anomalies.length&&<p className="muted">No anomalies recorded in this mission.</p>}</div></section>
      {selectedAnomaly&&<section className="panel"><small>SELECTED FINDING</small><h2>{selectedAnomaly.anomaly_id}</h2><p>{selectedAnomaly.description}</p><p className="muted">{selectedAnomaly.timestamp.replace('T',' · ')}<br/>{selectedAnomaly.location_id} · {selectedAnomaly.asset_id}</p><button onClick={()=>onInspect(selectedAnomaly)}>Open source evidence ↗</button></section>}
      <section className="panel"><small>RECORDED SENSOR READINGS</small><h2>{selectedAnomaly?.action_id||currentAction?.action_id||'Awaiting inspection'}</h2>{activeReadings.map(r=><div className="spot-sensor" key={r.reading_id}><span>{human(r.measurement_type)}</span><strong>{r.value} {r.unit}</strong><small>{r.timestamp.replace('T',' · ')} · {r.quality}</small></div>)}{!activeReadings.length&&<p className="muted">No readings recorded for this inspection.</p>}</section>
    </aside>
  </div>;
}
