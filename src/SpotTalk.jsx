import React,{useEffect,useRef,useState} from 'react';
import './spot-talk.css';
import {mapReferences,linkedMapText} from './chat-map-links.mjs';

function Answer({message,onSource,onLocation,locations}){
  const references=mapReferences(message.sources,locations);
  const linked=text=>linkedMapText(text,references).map((part,i)=>part.location_id?<button key={i} className="chat-map-link" aria-label={`View ${part.text} in 3D map`} title={`Open ${part.location_id} in the 3D map`} onClick={()=>onLocation(part.location_id,part.record)}>{part.text} ↗</button>:<React.Fragment key={i}>{part.text}</React.Fragment>);
  return <div className="spot-talk-answer">{message.content.split(/(\[E\d+\]|\*\*[^*]+\*\*)/g).map((part,i)=>{
    const source=message.sources?.find(s=>`[${s.key}]`===part);
    if(source)return <button key={i} className="chat-citation" title={`View ${source.label}`} onClick={()=>onSource(source)}>{source.label.split(' · ')[0]} ↗</button>;
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{linked(part.slice(2,-2))}</strong>;
    return <React.Fragment key={i}>{linked(part)}</React.Fragment>;
  })}</div>;
}

export default function SpotTalk({missions,locations,selectedMission,onMission,onLocation}){
  const [open,setOpen]=useState(false),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[scope,setScope]=useState('all'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(null),[evidence,setEvidence]=useState(null);
  const launcher=useRef(null),input=useRef(null),bottom=useRef(null),abort=useRef(null),sourceClose=useRef(null),sourceOpener=useRef(null);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages,busy,error]);
  useEffect(()=>{if(evidence)sourceClose.current?.focus();},[evidence]);
  useEffect(()=>()=>abort.current?.abort(),[]);
  const close=()=>{setOpen(false);launcher.current?.focus();};
  const closeEvidence=()=>{setEvidence(null);sourceOpener.current?.focus();};
  const send=async(question=draft,retrying=false)=>{
    if(busy||!question.trim())return;
    setBusy(true);setError('');setEvidence(null);setDraft('');
    const history=(retrying?messages.slice(0,-1):messages).slice(-6).map(m=>({role:m.role,content:m.content.slice(0,5500)}));
    if(!retrying)setMessages(old=>[...old,{role:'user',content:question}]);
    setRetry(question);abort.current=new AbortController();const timer=setTimeout(()=>abort.current?.abort(),120000);
    try{
      const response=await fetch('/api/spot-talk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,mission:scope,history}),signal:abort.current.signal});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Spot Talk could not connect.');
      setMessages(old=>[...old,{role:'assistant',content:data.answer,sources:data.sources,checked_at:data.checked_at,scope:data.scope}]);setRetry(null);
    }catch(e){setError(e.name==='AbortError'?'The request timed out. Databricks may still be starting; try again.':e.message);}
    finally{clearTimeout(timer);setBusy(false);}
  };
  const openMap=(id,record)=>{onLocation(id,record);setEvidence(null);setOpen(false);};
  const reset=()=>{setMessages([]);setError('');setRetry(null);setEvidence(null);};
  const suggestions=[`What went wrong in ${selectedMission}?`,'Which waypoints have the most failed actions?','Compare V1 and V2 inspection reliability.'];
  return <>
    <button ref={launcher} className={'spot-talk-launcher '+(open?'is-open':'')} aria-label={open?'Close Spot Talk':'Open Spot Talk'} aria-expanded={open} aria-controls="spot-talk-panel" onClick={()=>open?close():setOpen(true)}><img src="/brand/spot-cartoon.png" alt=""/><span>Spot Talk<small>Ask about your inspections</small></span><b aria-hidden="true">{open?'×':'↗'}</b></button>
    {open&&<section id="spot-talk-panel" className="spot-talk-panel" role="dialog" aria-modal="false" aria-labelledby="spot-talk-title" onKeyDown={e=>{if(e.key==='Escape'){evidence?closeEvidence():close();}}}>
      <header className="spot-talk-header"><img src="/brand/spot-cartoon.png" alt=""/><div><h2 id="spot-talk-title">Spot Talk</h2><p>Your inspection companion</p></div><button aria-label="Close chat" onClick={close}>×</button></header>
      <div className="spot-talk-scope"><label>Evidence scope<select aria-label="Spot Talk mission scope" value={scope} disabled={busy} onChange={e=>{setScope(e.target.value);reset();}}><option value="all">Across all missions</option>{missions.map(m=><option key={m.mission_id} value={m.mission_id}>{m.mission_id} · {m.configuration_version}</option>)}</select></label><button onClick={reset} disabled={busy||!messages.length}>New chat</button></div>
      <div className="spot-talk-thread" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation" aria-busy={busy}>
        {!messages.length&&<div className="spot-talk-welcome"><small>LET’S FOLLOW THE EVIDENCE</small><h3>What did Spot find?</h3><p>Ask about a mission, an asset, or a repeated inspection failure. I’ll look up the records and show you what supports the answer.</p><div>{suggestions.map(q=><button key={q} disabled={busy} onClick={()=>send(q)}>{q}<span>↗</span></button>)}</div><p className="chat-sample-note">Synthetic challenge data. Inspection failures don’t necessarily mean equipment failure.</p></div>}
        {messages.map((message,i)=><article key={i} className={'chat-message '+message.role}><small>{message.role==='user'?'YOU':'SPOT TALK'}</small><Answer message={message} locations={locations} onLocation={openMap} onSource={source=>{sourceOpener.current=document.activeElement;setEvidence(source);}}/>{message.role==='assistant'&&<div className="chat-answer-meta"><span>Live Databricks evidence</span>{!message.sources?.length&&<span>No record citations returned</span>}</div>}</article>)}
        {busy&&<div className="chat-working" role="status"><span className="chat-pulse"/>Checking records and preparing an answer…</div>}
        {error&&<div className="chat-error" role="alert"><p>{error}</p><button disabled={busy} onClick={()=>send(retry,true)}>Retry question</button></div>}
        <div ref={bottom}/>
      </div>
      {evidence&&<aside className="chat-evidence" aria-label="Supporting Databricks record"><div><strong>{evidence.label}</strong><button ref={sourceClose} aria-label="Close supporting record" onClick={closeEvidence}>×</button></div><small>SQL SOURCE · {evidence.kind}</small><dl>{Object.entries(evidence.record).filter(([,v])=>v!==null&&v!==undefined).map(([key,value])=><React.Fragment key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{String(value)}</dd></React.Fragment>)}</dl>{locations.some(l=>l.location_id===evidence.record.location_id)&&<button onClick={()=>openMap(evidence.record.location_id,evidence.record)}>View {evidence.record.location_id} in 3D map ↗</button>}{evidence.mission_id&&missions.some(m=>m.mission_id===evidence.mission_id)&&<button onClick={()=>{onMission(evidence.mission_id);close();}}>Open {evidence.mission_id} report ↗</button>}</aside>}
      <form className="spot-talk-composer" onSubmit={e=>{e.preventDefault();send();}}><label className="sr-only" htmlFor="spot-talk-question">Ask Spot Talk</label><textarea id="spot-talk-question" ref={input} rows="2" maxLength="1200" value={draft} placeholder="Ask what happened…" disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/><button type="submit" aria-label="Send question" disabled={busy||!draft.trim()}>↑</button></form>
      <p className="spot-talk-footnote">AI explanation · verify the linked records. Questions run SQL and may start the warehouse.</p>
    </section>}
  </>;
}
