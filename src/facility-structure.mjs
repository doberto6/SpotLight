// Union the registered wall footprints before generating surfaces. Intersections
// have no internal faces, overlapping caps or coplanar trim meshes.
export function wallFootprint(rectangles,openings=[]){
  const rounded=n=>Math.round(n*1e5)/1e5;
  const xs=[...new Set([...rectangles,...openings].flatMap(r=>[rounded(r.x-r.w/2),rounded(r.x+r.w/2)]))].sort((a,b)=>a-b);
  const zs=[...new Set([...rectangles,...openings].flatMap(r=>[rounded(r.z-r.d/2),rounded(r.z+r.d/2)]))].sort((a,b)=>a-b);
  const occupied=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<zs.length-1&&cells.has(i+','+j),cells=new Set();
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;if(rectangles.some(r=>Math.abs(x-r.x)<r.w/2&&Math.abs(z-r.z)<r.d/2)&&!openings.some(r=>Math.abs(x-r.x)<r.w/2&&Math.abs(z-r.z)<r.d/2))cells.add(i+','+j);}
  const caps=[],edges=[];
  for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++)if(occupied(i,j)){let end=i+1;while(occupied(end,j))end++;caps.push({x0:xs[i],x1:xs[end],z0:zs[j],z1:zs[j+1]});i=end-1;}
  for(const key of cells){const [i,j]=key.split(',').map(Number);for(const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]])if(!occupied(i+di,j+dj))edges.push(di?{axis:'x',line:xs[i+(di>0?1:0)],a:zs[j],b:zs[j+1],normal:di}:{axis:'z',line:zs[j+(dj>0?1:0)],a:xs[i],b:xs[i+1],normal:dj});}
  const merged=[];
  edges.sort((a,b)=>a.axis.localeCompare(b.axis)||a.line-b.line||a.normal-b.normal||a.a-b.a);
  for(const e of edges){const p=merged.at(-1);if(p&&p.axis===e.axis&&p.line===e.line&&p.normal===e.normal&&Math.abs(p.b-e.a)<1e-5)p.b=e.b;else merged.push({...e});}
  return {caps,edges:merged};
}

export function wallSurface(footprint,low,high,{bottom=true,top=true}={}){
  const positions=[],normals=[],uvs=[],indices=[];
  const quad=(points,normal,uv)=>{const a=points[0],b=points[1],c=points[2],u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],reverse=cross.reduce((s,n,i)=>s+n*normal[i],0)<0,index=positions.length/3;points.forEach((p,i)=>{positions.push(...p);normals.push(...normal);uvs.push(...uv[i]);});indices.push(...(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3]).map(i=>index+i));};
  for(const e of footprint.edges){const points=e.axis==='x'?[[e.line,low,e.a],[e.line,low,e.b],[e.line,high,e.b],[e.line,high,e.a]]:[[e.a,low,e.line],[e.b,low,e.line],[e.b,high,e.line],[e.a,high,e.line]];quad(points,e.axis==='x'?[e.normal,0,0]:[0,0,e.normal],[[e.a,low],[e.b,low],[e.b,high],[e.a,high]]);}
  for(const c of footprint.caps)for(const [y,normal,enabled] of [[low,-1,bottom],[high,1,top]])if(enabled){const points=[[c.x0,y,c.z0],[c.x1,y,c.z0],[c.x1,y,c.z1],[c.x0,y,c.z1]];quad(points,[0,normal,0],points.map(p=>[p[0],p[2]]));}
  return {positions,normals,uvs,indices};
}
