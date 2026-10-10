import * as THREE from 'three';
import {worldPoint,markerColor,waypointFloor} from './facility-layout.mjs';
import {stamp} from './replay-engine.mjs';
import {createStaticMissionPath} from './static-mission-path.js';
export function createMissionMarkers(scene,resources,locations,replay){
  const keep=r=>(resources.push(r),r),markers=[];
  const texture=(id,color,done=false)=>{const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#18272e';ctx.beginPath();ctx.roundRect(6,14,244,100,50);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='bold 42px Arial';ctx.fillText(id+(done?' ✓':''),128,80);const t=keep(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;return t;};
  for(const loc of locations){const p=worldPoint(loc.location_id),color=markerColor(loc.location_id,loc.zone_type),material=keep(new THREE.SpriteMaterial({map:texture(loc.location_id,color),depthTest:false,depthWrite:false})),sprite=new THREE.Sprite(material);sprite.position.set(p.x,1.4,p.z);sprite.userData.location=loc;sprite.renderOrder=10;sprite.scale.set(1.7,.85,1);scene.add(sprite);
    const ring=new THREE.Mesh(keep(new THREE.RingGeometry(.42,.5,32)),keep(new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85})));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.028,p.z);scene.add(ring);markers.push({loc,sprite,ring,color,normal:material.map,done:texture(loc.location_id,color,true)});
  }
  const path=createStaticMissionPath(scene,resources,replay);
  function update({time,floor,selected,anomalies,sourceTime=time,destination,camera,now,showLabels=true,showPath=true,timeline=replay}){
    path.setVisible(floor,showPath);
    replay=timeline;
    for(const m of markers){const id=m.loc.location_id,visible=floor==='all'||floor===m.loc.floor,visited=replay.visits.filter(v=>v.location_id===id&&v.at<=time*1000),done=visited.length>0&&visited.every(v=>(v.doneAt??v.at+Number(v.duration_sec||0)*1000)<=time*1000),flag=anomalies.some(a=>a.location_id===id&&stamp(a.timestamp)<=replay.start+sourceTime*1000),active=id===destination,chosen=id===selected;
      m.ring.visible=visible;m.sprite.visible=visible&&(showLabels||chosen||active);m.sprite.material.map=done?m.done:m.normal;m.sprite.material.color.set(flag?'#ff7373':'#ffffff');m.ring.material.color.set(flag?'#f24343':chosen?'#ffffff':m.color);m.ring.scale.setScalar(active?1.15+Math.sin(now*.004)*.15:chosen?1.4:1);
      // Screen-size floor at distance; world-size cap prevents close-view occlusion.
      const size=Math.min(2.4,Math.max(1.05,camera.position.distanceTo(m.sprite.position)*.045));m.sprite.scale.set(size*(chosen?1.15:1),size*.5,1);
    }
  }
  return {pickables:markers.map(m=>m.sprite),path,update};
}
