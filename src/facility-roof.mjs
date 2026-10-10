import {obstacles,rooms,floors,imageToWorld} from './facility-layout.mjs';
const key=p=>p.x.toFixed(5)+','+p.z.toFixed(5);
const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// The same supports define columns, beams, purlins and suspension points.
// Column feet fit wholly inside existing wall collision rectangles.
export function planRoof(){
 const candidates=new Map();
 for(const o of obstacles.filter(o=>o.type==='wall'))for(const sign of [-1,1]){const p={x:o.x+(o.w>o.d?sign*Math.max(0,o.w/2-.105):0),z:o.z+(o.d>=o.w?sign*Math.max(0,o.d/2-.105):0),floor:o.floor};candidates.set(o.floor+key(p),p);}
 const columns=new Map(),nearest=(p,floor)=>[...candidates.values()].filter(q=>q.floor===floor).reduce((best,q)=>!best||distance(p,q)<distance(p,best)?q:best,null),use=p=>(columns.set(p.floor+key(p),p),p);
 for(const f of floors)for(const p of f.outline)use(nearest(imageToWorld(p),f.id));
 const bays=rooms.map(r=>{const a=imageToWorld(r.rect.slice(0,2)),b=imageToWorld(r.rect.slice(2)),supports=[a,{x:b.x,z:a.z},b,{x:a.x,z:b.z}].map(p=>use(nearest(p,r.floor))),width=(distance(supports[0],supports[1])+distance(supports[3],supports[2]))/2;
  const point=(u,v)=>interpolate(interpolate(supports[0],supports[1],u),interpolate(supports[3],supports[2],u),v),count=Math.max(2,Math.ceil(width/2.4)),purlins=Array.from({length:count},(_,i)=>{const u=(i+.5)/count;return {u,a:point(u,0),b:point(u,1)};});
  return {...r,supports,point,purlins,width,center:point(.5,.5)};
 });
 return {columns:[...columns.values()],bays};
}

export function clerestoryOpenings(floor){
 return obstacles.filter(o=>o.type==='wall'&&o.exterior&&o.floor===floor).flatMap(o=>{const horizontal=o.w>o.d,length=Math.max(o.w,o.d),count=Math.floor((length-.8)/3.2);return Array.from({length:Math.max(0,count)},(_,i)=>{const along=(i+.5)*length/count-length/2;return {x:o.x+(horizontal?along:0),z:o.z+(horizontal?0:along),w:horizontal?1.55:o.w+.04,d:horizontal?o.d+.04:1.55,horizontal,floor};});});
}

export function deckRibs(floor,spacing=.6){
 const polygon=floor.outline.map(imageToWorld),min=Math.min(...polygon.map(p=>p.x)),max=Math.max(...polygon.map(p=>p.x)),ribs=[];
 for(let x=min+.3;x<max-.2;x+=spacing){const hits=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))hits.push(a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2)ribs.push({x,z:(hits[i]+hits[i+1])/2,length:hits[i+1]-hits[i]});}
 return ribs;
}
