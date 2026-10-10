import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

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
export default function Facility3D({locations,actions,floor,current,selectedLocation,onSelect,motion=false,showLabels=true}) {
  const hostRef=useRef(null),apiRef=useRef(null),selectRef=useRef(onSelect),stateRef=useRef({});
  const [error,setError]=useState('');selectRef.current=onSelect;stateRef.current={current,selectedLocation,motion,showLabels,floor};
  useEffect(()=>{
    const host=hostRef.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D graphics unavailable. Switch to the 2D map.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#0c1522');scene.add(new THREE.HemisphereLight('#e1f3ff','#25344a',2));
    const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.6;controls.maxZoom=4;controls.maxPolarAngle=Math.PI/2.2;
    const reset=()=>{const f=stateRef.current.floor;controls.target.set(f==='1'?-2.52:f==='2'?5.48:0,0,0);camera.position.set(controls.target.x+3,14,12);camera.zoom=f==='all'?1:1.3;camera.updateProjectionMatrix();controls.update();};apiRef.current={reset};reset();
    const resources=[],pickables=[],groups={1:[],2:[]},markers=[],particles=[];
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
    const failed=new Set(actions.filter(a=>a.status==='FAILED').map(a=>a.location_id));
    for(const loc of locations){
      const p=point(loc.location_id),color=failed.has(loc.location_id)?'#f2b45e':'#70b9d6';
      const marker=addMesh(new THREE.CylinderGeometry(.12,.16,.22,20),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2}));marker.position.copy(p);marker.userData.location=loc;pickables.push(marker);
      const halo=addMesh(new THREE.RingGeometry(.3,.42,48),new THREE.MeshBasicMaterial({color:'#ffcc66',side:THREE.DoubleSide,depthTest:false}));halo.rotation.x=-Math.PI/2;halo.position.set(p.x,.04,p.z);halo.renderOrder=3;halo.visible=false;
      const label=labelSprite(loc.location_id,color);label.position.set(p.x,.52,p.z);scene.add(label);resources.push(label.material.map,label.material);label.userData.location=loc;pickables.push(label);groups[loc.floor]?.push(marker,label,halo);markers.push({marker,label,halo,loc,color});
    }
    for(const f of ['1','2']){const points=actions.filter(a=>locations.find(l=>l.location_id===a.location_id)?.floor===f).map(a=>point(a.location_id).setY(.08));if(points.length<2)continue;
      const geo=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color:'#48d0ef',transparent:true,opacity:.8});resources.push(geo,mat);const line=new THREE.Line(geo,mat);scene.add(line);groups[f].push(line);
      const particle=addMesh(new THREE.SphereGeometry(.07,12,12),new THREE.MeshBasicMaterial({color:'#e5fbff'}));groups[f].push(particle);particles.push({particle,points,floor:f});
    }
    const applyFloor=()=>{for(const [f,objects] of Object.entries(groups))for(const o of objects)o.visible=stateRef.current.floor==='all'||stateRef.current.floor===f;};apiRef.current.applyFloor=()=>{applyFloor();reset();};applyFloor();
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    const pointerDown=e=>{down=[e.clientX,e.clientY]};const click=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables.filter(o=>o.visible))[0];if(hit)selectRef.current(hit.object.userData.location);};renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('click',click);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const halfHeight=Math.max(6.5,8.8/(w/h));camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let frameId;const frame=()=>{controls.update();for(const {marker,label,halo,loc,color} of markers){const visible=stateRef.current.floor==='all'||loc.floor===stateRef.current.floor;const selected=loc.location_id===stateRef.current.selectedLocation;halo.visible=visible&&selected;label.visible=visible&&(stateRef.current.showLabels||selected||loc.location_id===stateRef.current.current);marker.material.color.set(selected?'#ffcc66':loc.location_id===stateRef.current.current?'#47e0ff':color);marker.scale.setScalar(selected?1.9:loc.location_id===stateRef.current.current?1.4:1);}for(const {particle,points,floor:f} of particles){particle.visible=stateRef.current.motion&&(stateRef.current.floor==='all'||stateRef.current.floor===f);if(stateRef.current.motion){const v=(performance.now()*.00008%1)*(points.length-1),i=Math.floor(v);particle.position.lerpVectors(points[i],points[Math.min(i+1,points.length-1)],v-i);}}renderer.render(scene,camera);frameId=requestAnimationFrame(frame);};frame();
    return()=>{cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('click',click);for(const resource of resources)resource.dispose();renderer.dispose();renderer.domElement.remove();apiRef.current=null;};
  },[locations,actions]);
  useEffect(()=>{apiRef.current?.applyFloor?.();},[floor]);
  return <div className="facility-3d clean-facility"><div className="facility-3d-canvas" ref={hostRef} role="img" aria-label="Interactive 3D view of the supplied facility floor plans"/>{error?<p className="facility-3d-error" role="alert">{error}</p>:<div className="map-instructions">Drag to rotate · Scroll to zoom · Select a waypoint</div>}<button className="map-reset" onClick={()=>apiRef.current?.reset()}>Reset view</button><div className="map-key"><span>● Waypoint</span><span className="amber">● Failed inspection</span><span className="cyan">━ Mission route</span></div></div>;
}
