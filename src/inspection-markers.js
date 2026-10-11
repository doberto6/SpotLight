import * as THREE from 'three';
import {inspectionSnapshot} from './inspection-assets.mjs';

export function createInspectionMarkers(scene,resources,targets){
 const keep=r=>(resources.push(r),r),geometry=keep(new THREE.SphereGeometry(.16,12,8));
 const markers=targets.map(target=>{
  const material=keep(new THREE.MeshBasicMaterial({color:'#7ca7b3',transparent:true,opacity:.85,depthWrite:false})),mesh=new THREE.Mesh(geometry,material);mesh.position.set(...target.position);mesh.userData.target=target;scene.add(mesh);return {target,mesh};
 });
 // A single label follows the selected target; no forest of floating cards.
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const texture=keep(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false})));label.scale.set(1.8,.45,1);scene.add(label);
 let key='',lastUpdate=0,snapshots=[];
 const update=({now,floor,showTargets,selected,records,sourceTimestamp,camera})=>{
  if(now-lastUpdate>200||key!==selected){
   snapshots=markers.map(m=>({key:m.target.key,...inspectionSnapshot(m.target,records,sourceTimestamp)}));lastUpdate=now;
  }
  for(let i=0;i<markers.length;i++){
   const m=markers[i],chosen=m.target.key===selected;m.mesh.visible=(showTargets||chosen)&&(floor==='all'||floor===m.target.floor);
   m.mesh.material.color.set(chosen?'#ffffff':{finding:'#ec796a',inspected:'#76b596',visited:'#7ca7b3',inspecting:'#dfcd71',review:'#dfae69',pending:'#7ca7b3'}[snapshots[i]?.status||'pending']);m.mesh.scale.setScalar(chosen?1.25:1);
  }
  const current=markers.find(m=>m.target.key===selected);label.visible=!!current&&(floor==='all'||floor===current.target.floor);
  if(current){label.position.copy(current.mesh.position).add(new THREE.Vector3(0,.4,0));const distance=camera.position.distanceTo(label.position),size=Math.min(1.8,distance*.17);label.scale.set(size,size/4,1);
   if(key!==selected){const c=canvas.getContext('2d');c.clearRect(0,0,512,128);c.fillStyle='#132a32';c.beginPath();c.roundRect(2,2,508,124,16);c.fill();c.strokeStyle='#92cfbf';c.lineWidth=4;c.stroke();c.fillStyle='#eef5ed';c.textAlign='center';c.font='bold 46px Arial';c.fillText(current.target.asset_id,256,58);c.font='23px Arial';c.fillText('RECORDED INSPECTION TARGET',256,96);texture.needsUpdate=true;}
  }
  key=selected;
 };
 return {pickables:markers.map(m=>m.mesh),update,snapshot:()=>markers.map((m,i)=>({key:m.target.key,asset:m.target.asset_id,location:m.target.location_id,position:m.target.position,visible:m.mesh.visible,status:snapshots[i]?.status||'pending'}))};
}
