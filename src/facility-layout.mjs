// Registered to fictional_floor_plan.png (% of the full image). Estimated dimensions.
export const waypointPositions={WP01:[10,76],WP02:[10.3,51.5],WP03:[23.2,38],WP04:[19.6,13.5],WP05:[40.8,36],WP06:[50.6,13.5],WP07:[60.6,46],WP08:[34.6,67.5],WP09:[50.3,67.5],WP10:[61.4,70],WP11:[77.5,21.5],WP12:[91.5,23],WP13:[76.4,53],WP14:[90.6,58],WP15:[81.8,79]};
export const imageToWorld=([x,y])=>({x:(x-50)*.8,z:(y-50)*.45});
export const worldToImage=({x,z})=>[x/.8+50,z/.45+50];
export const worldPoint=id=>imageToWorld(waypointPositions[id]||[50,50]);
export const waypointFloor=id=>Number(id?.slice(2))>10?'2':'1';
export const zoneColors={Access:'#268de0',Electrical:'#efb52f',Process:'#36ad55',Mechanical:'#9746c8'};
export const markerColor=(id,zone)=>id==='WP05'?'#e64545':zoneColors[Object.keys(zoneColors).find(k=>k.toUpperCase()===zone?.toUpperCase())]||'#268de0';
export const floors=[{id:'1',outline:[[4,14],[14,14],[14,5],[58,5],[58,24],[65,24],[65,87],[24,87],[24,60],[18,60],[18,94],[6,94],[6,71],[4,71]]},{id:'2',outline:[[71,5],[98,5],[98,95],[71,95]]}];
export const rooms=[
 ['WP01',6,71,18,94,'access'],['WP02',5,42,14,70,'control_cabinets'],['WP03',14.5,29,28,56,'pump_skid'],['WP04',14.5,5,31.5,26,'pump_skid'],['WP05',28,29,56,51,'pipes'],['WP06',42,5,58,25,'compressor'],['WP07',57,25,65,63,'access'],['WP08',26,60,43.5,87,'turbine_generator'],['WP09',44,54,58,87,'turbine_generator'],['WP10',58,63,65,87,'valves'],['WP11',71,14,83.5,39,'control_cabinets'],['WP12',84,5,98,39,'heat_exchanger'],['WP13',71,42,83.5,71,'warehouse'],['WP14',85,42,98,71,'oil_transformer'],['WP15',71,73,98,95,'dock']
].map(([id,x1,y1,x2,y2,equipment])=>({id,floor:waypointFloor(id),rect:[x1,y1,x2,y2],equipment}));
export const bounds={minX:-40,maxX:40,minZ:-22.5,maxZ:22.5};
function inside(p,polygon){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
export function floorAt(x,z){const p=worldToImage({x,z});return floors.find(f=>inside(p,f.outline))?.id;}
const walls=[];
function wall(a,b,floor,exterior=false){const p=imageToWorld(a),q=imageToWorld(b);walls.push({x:(p.x+q.x)/2,z:(p.z+q.z)/2,w:Math.max(.22,Math.abs(p.x-q.x)),d:Math.max(.22,Math.abs(p.z-q.z)),h:3.2,type:'wall',floor,exterior});}
// Trace exterior perimeter. Entrance opening on the lower left; no inter-floor bridge.
for(const f of floors)for(let i=0;i<f.outline.length;i++){const a=f.outline[i],b=f.outline[(i+1)%f.outline.length];if(f.id==='1'&&a[1]===94&&b[1]===94){wall(a,[13,94],f.id,true);wall([9,94],b,f.id,true);}else wall(a,b,f.id,true);}
// Visible partitions; breaks register approximate door openings in the reference.
for(const [a,b,f='1'] of [
 [[14,14],[14,26]],[[14,29],[14,61]],[[14,67],[14,70]],
 [[5,42],[10,42]],[[13,42],[14,42]],[[5,70],[9,70]],[[12,70],[14,70]],
 [[14,29],[23,29]],[[27,29],[28,29]],[[28,29],[28,48]],[[28,53],[28,56]],[[14,56],[24,56]],
 [[31.5,5],[31.5,19]],[[31.5,24],[31.5,26]],[[14,26],[21,26]],[[25,26],[31.5,26]],
 [[42,5],[42,19]],[[42,24],[42,25]],[[42,25],[49,25]],[[53,25],[58,25]],
 [[26,60],[33,60]],[[37,60],[43.5,60]],[[43.5,60],[43.5,87]],
 [[44,54],[50,54]],[[54,54],[58,54]],[[58,54],[58,73]],[[58,77],[58,87]],
 [[58,63],[61,63]],[[64,63],[65,63]],
 [[83.5,14],[83.5,34],'2'],[[71,40],[78,40],'2'],[[81.5,40],[98,40],'2'],
 [[84,5],[84,34],'2'],[[84,45],[84,67],'2'],[[71,71],[78,71],'2'],[[81.5,71],[91,71],'2'],[[95,71],[98,71],'2']
])wall(a,b,f);
// Machinery pads sit beside inspection pins, never on top of them.
export const equipment=rooms.filter(r=>!['access','warehouse','dock','pipes','valves'].includes(r.equipment)).map(r=>{
  const [x1,y1,x2,y2]=r.rect,a=imageToWorld([x1,y1]),b=imageToWorld([x2,y2]),p=imageToWorld([(x1+x2)/2,(y1+y2)/2]),pin=worldPoint(r.id);
  const caps=r.equipment==='turbine_generator'?[5.2,7,4]:r.equipment==='heat_exchanger'?[5.5,4,3.3]:r.equipment==='compressor'?[5.5,3.6,3.4]:[4.8,4.4,3.2];
  const w=Math.min(caps[0],(b.x-a.x)*.48),d=Math.min(caps[1],(b.z-a.z)*.48),h=caps[2];
  // Keep each machine in the reference room and clear the registered inspection pin.
  p.x=pin.x<=p.x?b.x-w/2-.75:a.x+w/2+.75;
  p.z=pin.z<=p.z?b.z-d/2-.75:a.z+d/2+.75;
  return {...p,w,d,h,type:r.equipment==='turbine_generator'?'generator':'equipment',asset:r.equipment,floor:r.floor,waypoint:r.id};
});
for(const [id,px,py,w,d,h,asset] of [['WP03',25.8,36,2,1.9,3.1,'pressure_vessel'],['WP03',25.8,45,2,1.9,3.1,'pressure_vessel'],['WP05',41,31,20,1.3,1.8,'pipes'],['WP05',41,47,20,1.3,1.8,'pipes'],['WP10',62,81,2,2.8,2.2,'valves'],['WP13',73,54,1.2,8,2.2,'warehouse'],['WP15',95,82,1.6,5,2.1,'dock']])equipment.push({...imageToWorld([px,py]),w,d,h,asset,type:'equipment',waypoint:id,floor:waypointFloor(id)});
export const obstacles=[...walls,...equipment];
