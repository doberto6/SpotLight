import http from 'node:http';
import {createAPIHandler} from '../http-api.mjs';

const api=createAPIHandler();
// Vercel captures this Node HTTP server. Local npm dev still uses server.mjs.
const server=http.createServer(async(req,res)=>{
 if(await api(req,res)===false){
  res.statusCode=404;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({error:'API service only serves /api/ routes'}));
 }
});
server.listen(Number(process.env.PORT||3001));
