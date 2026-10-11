import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const assets=path.resolve(root,'data/SPOT_KnightHacks_Challenge_Kit Part One/04_ASSETS');
const server=await createServer({root,server:{host:'127.0.0.1',port:Number(process.env.PORT||3002),strictPort:true},plugins:[{
 name:'spotlight-challenge-images',
 configureServer(server){server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/kit-assets/'))return next();
  let relative;try{relative=decodeURIComponent(url.pathname.slice(12));}catch{res.statusCode=400;return res.end('Invalid asset path');}
  const file=path.resolve(assets,relative);
  if(!file.startsWith(assets+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end('Not found');}
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.jpg')||file.endsWith('.jpeg')?'image/jpeg':'text/plain');
  fs.createReadStream(file).pipe(res);
 });}
}]});
await server.listen();
server.printUrls();
