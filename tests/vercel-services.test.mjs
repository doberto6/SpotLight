import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createAPIHandler} from '../http-api.mjs';
import {sameOrigin} from '../spot-talk.mjs';

test('Spot Talk accepts trusted proxy origins and rejects unrelated origins',()=>{
 const request={headers:{host:'127.0.0.1:4000',origin:'https://spotlight.example','x-vercel-deployment-url':'spotlight.example'}};
 assert.equal(sameOrigin(request,{trustedProxy:true}),true);
 assert.equal(sameOrigin(request,{trustedProxy:false}),false);
 assert.equal(sameOrigin({...request,headers:{...request.headers,origin:'https://other.example'}},{trustedProxy:true}),false);
});

test('deployment API preserves public paths, demo insights, reports and chat',async()=>{
 const api=createAPIHandler({mode:'demo'});
 const server=http.createServer(async(req,res)=>{if(await api(req,res)===false){res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const route of ['/api/health','/api/data','/api/databricks/overview','/api/databricks/mission-report?mission=M006','/api/ml/overview']){
   const response=await fetch(base+route);
   assert.equal(response.status,200,route);
   assert.match(response.headers.get('content-type'),/application\/json/);
   assert.ok(await response.json());
  }
  const missing=await fetch(base+'/api/unknown');
  assert.equal(missing.status,404);
  assert.ok((await missing.json()).error);
  const chat=await fetch(base+'/api/spot-talk',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({question:'What happened at WP06?'})});
  assert.equal(chat.status,200);
  assert.match((await chat.json()).answer,/Demo summary/);
  const blocked=await fetch(base+'/api/spot-talk',{method:'POST',headers:{'content-type':'application/json',origin:'https://unrelated.example'},body:JSON.stringify({question:'What happened?'})});
  assert.equal(blocked.status,403);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
