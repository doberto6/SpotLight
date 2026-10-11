import {handleML,mlQueries} from './ml-queries.mjs';
import {handleSpotTalk,askSpotTalk} from './spot-talk.mjs';
import {createDataGateway} from './data-gateway.mjs';
import {createDemoData,validId,validConfiguration} from './demo-data.mjs';
import {features} from './intelligence-queries.mjs';
import {loadData} from './data.mjs';
import {queries,warehouseHealth} from './databricks.mjs';

export function createAPIHandler({data=loadData(),mode=process.env.SPOTLIGHT_DATA_MODE||'auto'}={}){
 const demo=createDemoData(data);
 const gateway=createDataGateway({health:warehouseHealth,mode});
 return async function api(req,res){
  // Public service rewrites preserve /api; never strip that prefix.
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/api/'))return false;
  try{
 const url=new URL(req.url,'http://localhost');
 const send=value=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(value));};
 const run=(live,fallback)=>gateway.run(live,fallback,res);
 if(url.pathname.startsWith('/api/ml/')){
  const safe=Object.fromEntries(Object.keys(mlQueries).map(key=>[key,(...args)=>run(()=>mlQueries[key](...args),()=>demo.ml[key](...args))]));
  return await handleML(req,res,url,safe);
 }
 if(url.pathname==='/api/spot-talk')return await handleSpotTalk(req,res,input=>run(()=>askSpotTalk(input),()=>demo.chat(input)));
 if(url.pathname==='/api/data-mode')return send(await gateway.status(url.searchParams.get('refresh')==='true'));
 if(url.pathname==='/api/health')return send({status:'ok',uptime_seconds:Math.round(process.uptime()),checked_at:new Date().toISOString()});
 if(url.pathname==='/api/databricks/health')return send({source:'Databricks status API',rows:await queries.health()});
 if(url.pathname==='/api/data')return send(data);
 const configuration=url.searchParams.get('configuration');
 const featureRoutes={
  '/api/databricks/risk':()=>{validConfiguration(configuration);return run(()=>features.risk(configuration),()=>demo.risk(configuration));},
  '/api/databricks/waypoint':()=>{const id=validId(url.searchParams.get('location'));validConfiguration(configuration);return run(()=>features.waypoint(id,configuration),()=>demo.waypoint(id,configuration));},
  '/api/databricks/sensor-trends':()=>run(features.trends,demo.trends),
  '/api/databricks/mission-report':()=>{const id=validId(url.searchParams.get('mission'));return run(()=>features.report(id),()=>demo.report(id));},
  '/api/databricks/overview':()=>run(queries.overview,demo.overview),
  '/api/databricks/evidence':()=>{const kind=url.searchParams.get('kind'),id=validId(url.searchParams.get('id'));if(!['mission','waypoint','action'].includes(kind))throw Object.assign(Error('Invalid evidence selection'),{status:400});return run(()=>queries.evidence(kind,id),()=>demo.evidence(kind,id));}
 };
 if(featureRoutes[url.pathname])return send(await featureRoutes[url.pathname]());
 const dbRoutes={'/api/databricks/missions':'missions','/api/databricks/hidden-failures':'hiddenFailures','/api/databricks/hotspots':'hotspots','/api/databricks/anomalies':'anomalies','/api/databricks/reliability':'reliability'};
 const key=dbRoutes[url.pathname];
 if(key){const rows=await run(queries[key],demo[key]);return send({source:res.getHeader('X-SPOTlight-Data-Mode')==='demo'?demo.source:'Databricks SQL connector',rows});}
 if(url.pathname==='/api/intelligence')return send(await run(async()=>({source:'Databricks SQL connector',rows:(await queries.hotspots()).map(r=>({...r,key:r.location_id,failureRate:r.failure_rate}))}),()=>({source:demo.source,rows:data.metrics.byLocation})));

   res.statusCode=404;send({error:'Unknown API endpoint'});
  }catch(e){res.statusCode=e.status||502;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:e.message}));}
  return true;
 };
}
