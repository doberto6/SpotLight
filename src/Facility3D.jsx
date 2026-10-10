import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createSpot,createRoom} from './spot-scene.js';

// Registered against the waypoint pins printed on the supplied floor-plan image.
// These are image coordinates, not surveyed building coordinates.
export const waypointImagePositions = {
  WP01:[10,76], WP02:[10.3,51.5], WP03:[23.2,38], WP04:[19.6,13.5],
  WP05:[40.8,36], WP06:[50.6,13.5], WP07:[60.6,46], WP08:[34.6,67.5],
  WP09:[50.3,67.5], WP10:[61.4,70], WP11:[77.5,21.5], WP12:[91.5,23],
  WP13:[76.4,53], WP14:[90.6,58], WP15:[81.8,79]
};

const point = id => {
  const [x,y] = waypointImagePositions[id];
  return new THREE.Vector3((x - 50) * .16, .09, (y - 50) * .09);
};

function labelSprite(text, color) {
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#102033';ctx.beginPath();ctx.roundRect(4,4,184,56,12);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#eef6ff';ctx.font='bold 28px Arial';ctx.textAlign='center';ctx.fillText(text,96,42);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(.8,.27,1);return sprite;
}
export default function Facility3D({locations,actions,anomalies=[],events=[],replayIndex=0,replaySpeed=1,floor,current,selectedLocation,onSelect,motion=false,showLabels=true,simulation=false}) {
  const hostRef=useRef(null),apiRef=useRef(null),selectRef=useRef(onSelect),stateRef=useRef({});
  const [follow,setFollow]=useState(true);
  const [error,setError]=useState('');selectRef.current=onSelect;stateRef.current={current,selectedLocation,motion,showLabels,floor,anomalies,events,replayIndex,replaySpeed,follow};
  useEffect(()=>{
    const host=hostRef.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D graphics unavailable. Switch to the 2D map.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#0c1522');scene.add(new THREE.HemisphereLight('#e1f3ff','#25344a',2));
    const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.6;controls.maxZoom=4;controls.maxPolarAngle=Math.PI/2.2;
    const reset=()=>{const f=stateRef.current.floor;controls.target.set(f==='1'?-2.52:f==='2'?5.48:0,0,0);camera.position.set(controls.target.x+3,14,12);camera.zoom=f==='all'?1:1.3;camera.updateProjectionMatrix();controls.update();};apiRef.current={reset};reset();
    const resources=[],pickables=[],groups={1:[],2:[]},markers=[],particles=[];
    const rooms=[];
    const robot=simulation?createSpot(resources):null;if(robot)scene.add(robot);
    const addMesh=(geo,mat)=>{resources.push(geo,mat);const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);return mesh;};
    const loader=new THREE.TextureLoader();
    // Crop the same supplied image into two registered floor slabs; waypoint positions stay identical to 2D.
    for(const [f,start,span] of [['1',0,.685],['2',.685,.315]]){
      const width=16*span,x=-8+16*(start+span/2);
      const texture=loader.load('/kit-assets/fictional_floor_plan.png');texture.colorSpace=THREE.SRGBColorSpace;texture.repeat.set(span,1);texture.offset.set(start,0);texture.anisotropy=renderer.capabilities.getMaxAnisotropy();resources.push(texture);
      const slab=addMesh(new THREE.BoxGeometry(width,.18,9),new THREE.MeshStandardMaterial({color:'#243b52',roughness:.85}));slab.position.set(x,-.16,0);
      const plane=addMesh(new THREE.PlaneGeometry(width,9),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,color:'#c4d5e5'}));plane.rotation.x=-Math.PI/2;plane.position.set(x,-.06,0);groups[f].push(slab,plane);
      const edges=new THREE.EdgesGeometry(slab.geometry),material=new THREE.LineBasicMaterial({color:'#617c96'});resources.push(edges,material);const outline=new THREE.LineSegments(edges,material);outline.position.copy(slab.position);scene.add(outline);groups[f].push(outline);
    }
    const routeActions=[...actions].sort((a,b)=>String(a.timestamp||'').localeCompare(String(b.timestamp||''))||a.mission_id.localeCompare(b.mission_id)||Number(a.sequence)-Number(b.sequence));
    const failed=new Set(routeActions.filter(a=>a.status==='FAILED').map(a=>a.location_id));
    const palette=getComputedStyle(document.documentElement);
    const severityRank={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};
    const visitedColor=loc=>{
      const reachedActions=new Set(routeActions.slice(0,target<0?0:Math.floor(particles[0]?.progress||0)+1).map(a=>a.action_id));
      const findings=stateRef.current.anomalies.filter(a=>a.location_id===loc.location_id&&reachedActions.has(a.action_id));
      const severity=findings.reduce((highest,a)=>(severityRank[a.severity]||0)>(severityRank[highest]||0)?a.severity:highest,'');
      return severity?palette.getPropertyValue('--severity-'+severity.toLowerCase()).trim():routeActions.some(a=>reachedActions.has(a.action_id)&&a.location_id===loc.location_id&&a.status==='FAILED')?'#ef5350':'#45d483';
    };
    for(const loc of locations){
      const p=point(loc.location_id),color=failed.has(loc.location_id)?'#f2b45e':'#70b9d6';
      if(simulation){const room=createRoom(scene,resources,p,loc);rooms.push({...room,loc});groups[loc.floor]?.push(room.room,room.outline);pickables.push(room.room);}
      const marker=addMesh(new THREE.CylinderGeometry(.12,.16,.22,20),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2}));marker.position.copy(p);marker.userData.location=loc;pickables.push(marker);
      const halo=addMesh(new THREE.RingGeometry(.3,.42,48),new THREE.MeshBasicMaterial({color:'#ffcc66',side:THREE.DoubleSide,depthTest:false}));halo.rotation.x=-Math.PI/2;halo.position.set(p.x,.04,p.z);halo.renderOrder=3;halo.visible=false;
      const label=labelSprite(loc.location_id,color);label.position.set(p.x,simulation?1.25:.52,p.z);scene.add(label);resources.push(label.material.map,label.material);label.userData.location=loc;pickables.push(label);groups[loc.floor]?.push(marker,label,halo);markers.push({marker,label,halo,loc,color});
    }
    for(const f of ['1','2']){const ids=routeActions.map(a=>a.location_id);const points=ids.map(id=>point(id).setY(.08));if(!points.length)continue;
      const segments=[];for(let n=1;n<points.length;n++){if(routeActions[n-1].mission_id===routeActions[n].mission_id&&[ids[n-1],ids[n]].every(id=>locations.find(l=>l.location_id===id)?.floor===f))segments.push(points[n-1],points[n]);}
      const geo=new THREE.BufferGeometry().setFromPoints(segments),mat=new THREE.LineBasicMaterial({color:'#48d0ef',transparent:true,opacity:.8});resources.push(geo,mat);const line=new THREE.LineSegments(geo,mat);scene.add(line);groups[f].push(line);
      const particle=addMesh(new THREE.SphereGeometry(.07,12,12),new THREE.MeshBasicMaterial({color:'#e5fbff'}));particle.position.copy(points[0]);groups[f].push(particle);particles.push({particle,points,ids,floor:f,progress:0});
    }
    const applyFloor=()=>{for(const [f,objects] of Object.entries(groups))for(const o of objects)o.visible=stateRef.current.floor==='all'||stateRef.current.floor===f;};apiRef.current.applyFloor=()=>{applyFloor();reset();};applyFloor();
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    const pointerDown=e=>{down=[e.clientX,e.clientY]};const click=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables.filter(o=>o.visible))[0];if(hit)selectRef.current(hit.object.userData.location);};renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('click',click);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const halfHeight=Math.max(6.5,8.8/(w/h));camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const visited=new Set();let lastFrame=performance.now(),frameId,lastIndex=-1,target=-1;
    const frame=()=>{
      const now=performance.now(),delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;controls.update();
      const replay=stateRef.current;
      const elapsed=replay.events.slice(0,replay.replayIndex+1);
      const actionId=[...elapsed].reverse().find(e=>e.details?.action_id)?.details.action_id;
      target=routeActions.findIndex(a=>a.action_id===actionId);
      if(replay.replayIndex<lastIndex||(!replay.motion&&replay.replayIndex!==lastIndex)){visited.clear();for(const route of particles)route.progress=Math.max(0,target);}
      lastIndex=replay.replayIndex;
      if(robot)robot.visible=false;
      for(const route of particles){
        const {particle,points,ids,floor:f}=route;
        const targetFloor=locations.find(l=>l.location_id===routeActions[target]?.location_id)?.floor;
        particle.visible=target>=0&&targetFloor===f&&(replay.floor==='all'||replay.floor===f);
        if(stateRef.current.motion){
          // Ease toward the next recorded visit so SPOT visibly walks between rooms.
          if(target>=0)route.progress=THREE.MathUtils.damp(route.progress,target,3.5*replay.replaySpeed,delta);
          // Only completed segments count as arrivals; the approaching endpoint stays unvisited.
        }
        if(target>=0)for(let n=0;n<=Math.floor(route.progress);n++)visited.add(ids[n]);
        const i=Math.floor(route.progress);particle.position.lerpVectors(points[i],points[Math.min(i+1,points.length-1)],route.progress-i);
        if(robot&&particle.visible){
          robot.visible=true;robot.position.copy(particle.position);robot.position.y=0;
          const next=points[Math.min(i+1,points.length-1)],previous=points[i];
          if(next.distanceToSquared(previous)>.001)robot.rotation.y=-Math.atan2(next.z-previous.z,next.x-previous.x);
          const walking=replay.motion&&route.progress<target;
          robot.userData.legs.forEach((leg,n)=>leg.rotation.z=walking?Math.sin(now*.012+(n===0||n===3?0:Math.PI))*.35:0);
          if(replay.follow){const offset=camera.position.clone().sub(controls.target);controls.target.lerp(robot.position,.06);camera.position.copy(controls.target).add(offset);}
          particle.visible=false;
        }
      }
      for(const {room,loc} of rooms){const reached=visited.has(loc.location_id);room.material.color.set(reached?visitedColor(loc):'#39536b');room.material.opacity=loc.location_id===replay.current?.toUpperCase()?.trim()? .5:.24;}
      for(const {marker,label,halo,loc,color} of markers){
        const visible=stateRef.current.floor==='all'||loc.floor===stateRef.current.floor;
        const selected=loc.location_id===stateRef.current.selectedLocation,wasVisited=visited.has(loc.location_id);
        halo.visible=visible&&selected;label.visible=visible&&(stateRef.current.showLabels||selected||wasVisited);
        const tint=wasVisited?visitedColor(loc):'#70b9d6';marker.material.color.set(tint);marker.material.emissive.set(tint);
        marker.scale.setScalar(selected?1.9:wasVisited?1.25:1);
      }
      renderer.render(scene,camera);frameId=requestAnimationFrame(frame);
    };frame();
    return()=>{cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('click',click);for(const resource of resources)resource.dispose();renderer.dispose();renderer.domElement.remove();apiRef.current=null;};
  },[locations,actions,simulation]);
  useEffect(()=>{apiRef.current?.applyFloor?.();},[floor]);
  return <div className="facility-3d clean-facility"><div className="facility-3d-canvas" ref={hostRef} role="img" aria-label={simulation?'3D SPOT mission simulation with raised rooms':'Interactive 3D view of the supplied facility floor plans'}/>{error?<p className="facility-3d-error" role="alert">{error}</p>:<div className="map-instructions">Drag to rotate · Scroll to zoom · Select a waypoint{simulation&&<label className="spot-follow"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/> Follow SPOT</label>}</div>}<button className="map-reset" onClick={()=>apiRef.current?.reset()}>Reset view</button><div className="map-key"><span>{simulation?'Yellow robot · SPOT':'● Waypoint'}</span><span className="amber">● Failed inspection</span><span className="cyan">━ Mission route</span>{simulation&&<span>Illustrative rooms and movement between recorded visits</span>}</div></div>;
}
