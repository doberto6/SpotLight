// UI requests use a passive warehouse check before SQL. Training/setup stay live-only.
export function createDataGateway({health,mode='auto',now=Date.now,ttl=15000}={}){
 if(!['auto','demo','live'].includes(mode))throw Error('SPOTLIGHT_DATA_MODE must be auto, demo, or live');
 let cached,pending;
 const remember=value=>(cached={...value,expires:now()+ttl});
 async function status(force=false){
  if(mode==='demo')return {mode:'demo',reason:'Demo mode selected',warehouse_state:'NOT_CHECKED'};
  if(!force&&cached&&cached.expires>now())return cached;
  if(pending)return pending;
  pending=(async()=>{try{const h=await health();return remember({mode:h.state==='RUNNING'?'live':mode==='live'?'error':'demo',reason:h.state==='RUNNING'?'Warehouse running':`Warehouse ${h.state}`,warehouse_state:h.state});}
   catch{return remember({mode:mode==='live'?'error':'demo',reason:'Databricks unavailable or not configured',warehouse_state:'UNAVAILABLE'});}
  })().finally(()=>{pending=null;});
  return pending;
 }
 async function run(live,demo,res){
  const state=await status();let value,selected=state;
  if(state.mode==='live'){
   try{value=await live();}
   catch(error){if(mode==='live')throw error;selected=remember({mode:'demo',reason:'Databricks request failed',warehouse_state:state.warehouse_state});}
  }else if(mode==='live')throw Error(`${state.reason}. Live-only mode is enabled.`);
  if(selected.mode==='demo')value=await demo();
  res?.setHeader('X-SPOTlight-Data-Mode',selected.mode);
  res?.setHeader('Cache-Control','no-store');
  return value;
 }
 return {run,status};
}
