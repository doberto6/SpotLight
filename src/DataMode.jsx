import React,{useEffect,useState} from 'react';
import './data-mode.css';
export function DemoNotice({data,forecast=false}){
 if(data?.data_mode!=='demo'&&data?.status?.mode!=='demo')return null;
 return <p className="demo-notice" role="note">{forecast?'Saved demo forecasts · This snapshot is not recalculated from live data.':'Demo records · Bundled synthetic challenge data, calculated locally.'}</p>;
}
export default function DataMode(){
 const [state,setState]=useState(null),[busy,setBusy]=useState(false);
 async function check(force=false){setBusy(true);try{const r=await fetch('/api/data-mode'+(force?'?refresh=true':''));if(r.ok)setState(await r.json());}catch{}finally{setBusy(false);}}
 useEffect(()=>{check();const update=()=>check();window.addEventListener('spotlight-data-mode',update);const timer=setInterval(()=>check(),20000);return()=>{clearInterval(timer);window.removeEventListener('spotlight-data-mode',update);}},[]);
 if(state?.mode!=='demo')return null;
 return <aside className="data-mode-banner" aria-label="Demo data status"><div><b>Demo data</b><span>{state.reason} · The dashboard uses bundled challenge records.</span></div><button disabled={busy} onClick={()=>check(true)}>{busy?'Checking…':'Check connection'}</button></aside>;
}
