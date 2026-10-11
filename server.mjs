import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {kit} from './data.mjs';
import {createAPIHandler} from './http-api.mjs';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const api=createAPIHandler();
const production=process.argv.includes('--production');
if(production&&!fs.existsSync('dist/index.html'))throw Error('Run npm run build before npm start');
const vite=production?null:await (await import('vite')).createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});
const server=http.createServer(async(req,res)=>{try{
 if(await api(req,res)!==false)return;
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/kit-assets/')){const relative=decodeURIComponent(url.pathname.slice(12));const root=path.join(kit,'04_ASSETS');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end('Not found');}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'image/jpeg');return fs.createReadStream(file).pipe(res);}
 if(vite)return vite.middlewares(req,res);
 let file=path.resolve('dist','.'+url.pathname);if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.resolve('dist/index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);
 }catch(e){res.statusCode=e.status||502;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:e.message}));}});

const port=Number(process.env.PORT||3000);
server.listen(port,()=>console.log(`SPOTlight running at http://localhost:${port}`));


