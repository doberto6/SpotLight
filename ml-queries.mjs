import {createHash} from 'node:crypto';
import {query,table} from './databricks.mjs';
export const sourceNames=['actions','missions','locations','assets'];
export async function sourceSignature(run=query){
 const rows=await run(sourceNames.map(name=>`SELECT '${name}' name,COUNT(*) n,CAST(SUM(CAST(xxhash64(to_json(struct(*))) AS DECIMAL(38,0))) AS STRING) fingerprint FROM ${table(name)}`).join(' UNION ALL '));
 return createHash('sha256').update(JSON.stringify(rows.sort((a,b)=>a.name.localeCompare(b.name)).map(r=>[r.name,String(r.n),r.fingerprint]))).digest('hex');
}
export function validPrediction(row){
 const p=row.predicted_failure_probability;
 if(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1||!/^WP\d{2,5}$/.test(row.location_id)||!Number.isInteger(row.historical_sample_size)||row.historical_sample_size<0)throw Error('Invalid stored ML prediction');
 const expected=p>=.30?'Elevated':p>=.15?'Watch':'Lower';
 if(row.risk_category!==expected)throw Error('ML risk classification does not match its estimate');
 if(!Number.isFinite(row.historical_failure_rate)||row.historical_failure_rate<0||row.historical_failure_rate>1)throw Error('Invalid stored historical rate');
 return row;
}
export function publishSQL(result){
 if(!/^lr-[A-Za-z0-9-]+$/.test(result.metrics.model_version)||!result.predictions.length)throw Error('Invalid model publication');
 const version=result.metrics.model_version;
 const rows=[['metrics','model',result.metrics],...result.predictions.map(row=>{validPrediction(row);if(row.model_version!==version)throw Error('Mixed model versions');return ['prediction',row.target_id,row];})];
 const hex=value=>`'${Buffer.from(String(value)).toString('hex')}'`;
 // One INSERT is one Delta commit; metrics and predictions cannot appear separately.
 return `INSERT INTO ${table('ml_runs')} SELECT model_version,record_kind,decode(unhex(target_hex),'UTF-8'),decode(unhex(payload_hex),'UTF-8'),CURRENT_TIMESTAMP() FROM VALUES `+rows.map(([kind,id,payload])=>`('${version}','${kind}',${hex(id)},${hex(JSON.stringify(payload))})`).join(',')+` AS batch(model_version,record_kind,target_hex,payload_hex) WHERE NOT EXISTS (SELECT 1 FROM ${table('ml_runs')} published WHERE published.model_version='${version}')`;
}
export function createMLQueries(run=query){
 async function latest(){
  try{
   const rows=await run(`SELECT model_version,payload,published_at FROM ${table('ml_model_metrics')} ORDER BY published_at DESC,model_version DESC LIMIT 1`);
   if(!rows.length)return null;
   const metadata=JSON.parse(rows[0].payload);
   if(metadata.model_version!==rows[0].model_version)throw Error('Invalid model metadata');
   return {...metadata,published_at:rows[0].published_at};
  }catch(e){if(/TABLE_OR_VIEW_NOT_FOUND|TABLE_NOT_FOUND/i.test(e.message))return null;throw e;}
 }
 const predictionsFor=async(version,location)=>{
  if(!/^lr-[A-Za-z0-9-]+$/.test(version))throw Error('Invalid model version');
  if(location&&!/^WP\d{2,5}$/.test(location))throw Error('Invalid waypoint identifier');
  return (await run(`SELECT payload FROM ${table('ml_predictions')} WHERE model_version='${version}'${location?` AND get_json_object(payload,'$.location_id')='${location}'`:''}`)).map(r=>validPrediction(JSON.parse(r.payload))).sort((a,b)=>b.predicted_failure_probability-a.predicted_failure_probability||a.target_id.localeCompare(b.target_id));
 };
 async function statusFor(metadata){
  if(!metadata)return {state:'not_trained',message:'No published model. Run npm run ml:train to train and publish from Databricks.',source:'Databricks Delta'};
  const current=await sourceSignature(run);
  const stale=metadata.source_signature!==current;
  return {state:stale?'stale':'ready',stale,model_version:metadata.model_version,trained_at:metadata.trained_at,published_at:metadata.published_at,data_cutoff:metadata.data_cutoff,candidate_count:metadata.candidate_count,experimental:true,source:'Databricks Delta',data_age_days:Math.floor((Date.now()-new Date(metadata.data_cutoff).getTime())/86400000),message:stale?'Source data changed; retrain before using these forecasts.':'Model results available. Forecasts start after the recorded data cutoff.'};
 }
 async function predictions(location){
  const metadata=await latest();
  if(!metadata)return {state:'not_trained',rows:[],message:'No published model. Run npm run ml:train.',source:'Databricks Delta'};
  const rows=await predictionsFor(metadata.model_version,location);
  if(!location&&rows.length!==metadata.candidate_count)throw Error('Published forecast count does not match model metadata');
  return {state:'ready',source:'Databricks Delta',model_version:metadata.model_version,rows};
 }
 return {status:async()=>statusFor(await latest()),predictions,metrics:async()=>({source:'Databricks Delta',model:await latest()}),
  overview:async()=>{const model=await latest();const status=await statusFor(model);const rows=model?await predictionsFor(model.model_version):[];
   if(model&&rows.length!==model.candidate_count)throw Error('Published forecast count does not match model metadata');
   return {source:'Databricks Delta',status,model,rows};}};
}
export const mlQueries=createMLQueries();
export async function handleML(req,res,url,queries=mlQueries){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'Use GET for ML results.'}));}
 try{
  let response;
  if(url.pathname==='/api/ml/status')response=await queries.status();
  else if(url.pathname==='/api/ml/overview')response=await queries.overview();
  else if(url.pathname==='/api/ml/metrics')response=await queries.metrics();
  else if(url.pathname==='/api/ml/predictions')response=await queries.predictions();
  else if(/^\/api\/ml\/predictions\/WP\d{2,5}$/.test(url.pathname))response=await queries.predictions(url.pathname.split('/').at(-1));
  else{res.statusCode=404;response={error:'Unknown ML endpoint or invalid waypoint.'};}
  res.end(JSON.stringify(response));
 }catch(e){res.statusCode=502;res.end(JSON.stringify({error:`Predictive intelligence unavailable: ${e.message}`}));}
}
