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

function labelSprite(text, active) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=active?'#49cdfa':'#13253a';ctx.strokeStyle=active?'#b6efff':'#7898b5';
  ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(5,5,246,70,13);ctx.fill();ctx.stroke();
  ctx.fillStyle=active?'#082033':'#eef6ff';ctx.font='bold 37px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,42);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
  sprite.scale.set(1.17,.37,1);sprite.renderOrder=4;return sprite;
}

export default function Facility3D({locations,actions,floor,current,onSelect}) {
  const hostRef=useRef(null), selectRef=useRef(onSelect), apiRef=useRef(null);
  const [error,setError]=useState('');
  selectRef.current=onSelect;

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}
    catch{setError('3D graphics are unavailable in this browser. Use the 2D map to inspect waypoints.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setClearColor('#0b1728');host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#0b1728');scene.fog=new THREE.Fog('#0b1728',22,38);
    scene.add(new THREE.HemisphereLight('#d9efff','#263c50',2.1));
    const sun=new THREE.DirectionalLight('#ffffff',2.3);sun.position.set(-5,12,8);scene.add(sun);
    const camera=new THREE.PerspectiveCamera(42,1,.1,100);
    camera.position.set(1.5,13,17);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=7;controls.maxDistance=33;
    controls.maxPolarAngle=Math.PI/2.08;
    controls.target.set(0,0,0);controls.update();
    apiRef.current={camera,controls};

    const geometry=[];const materials=[];const textures=[];const pickables=[];
    const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.12,...extra});materials.push(m);return m;};
    const base=mat('#1e354b'),edge=mat('#6b91a8'),room=mat('#2e5269',{transparent:true,opacity:.8}),critical=mat('#b44358'),warning=mat('#b4813c'),normal=mat('#366d79'),active=mat('#46d2f6',{emissive:'#197799',emissiveIntensity:.8});
    const box=(w,h,d,m,x,y,z)=>{const g=new THREE.BoxGeometry(w,h,d);geometry.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);scene.add(o);return o;};
    // Low-poly room masses are schematic. The floor-plan texture supplies the actual reference layout.
    box(10.75,.16,8.9,base,-2.63,-.17,0);box(5.08,.16,8.9,base,5.43,-.17,0);
    const outline=(x,w)=>{const points=[new THREE.Vector3(x-w/2,.02,-4.45),new THREE.Vector3(x+w/2,.02,-4.45),new THREE.Vector3(x+w/2,.02,4.45),new THREE.Vector3(x-w/2,.02,4.45),new THREE.Vector3(x-w/2,.02,-4.45)];const g=new THREE.BufferGeometry().setFromPoints(points);geometry.push(g);scene.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:'#628299',transparent:true,opacity:.8})));};
    outline(-2.63,10.75);outline(5.43,5.08);
    const floorMeshes={};
    for(const [number,span,start] of [['1',.685,0],['2',.315,.685]]){
      const width=16*span,center=-8+16*(start+span/2);
      const texture=new THREE.TextureLoader().load('/kit-assets/fictional_floor_plan.png',t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();});
      texture.repeat.set(span,1);texture.offset.set(start,0);textures.push(texture);
      const planeGeo=new THREE.PlaneGeometry(width,9);geometry.push(planeGeo);
      const planeMat=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.78,side:THREE.DoubleSide});materials.push(planeMat);
      const plane=new THREE.Mesh(planeGeo,planeMat);plane.rotation.x=-Math.PI/2;plane.position.set(center,-.075,0);scene.add(plane);floorMeshes[number]=plane;
    }

    const locationById=new Map(locations.map(l=>[l.location_id,l]));
    const anomaliesByLocation=new Map();
    for(const a of actions)if(a.status==='FAILED')anomaliesByLocation.set(a.location_id,(anomaliesByLocation.get(a.location_id)||0)+1);
    const floorGroups={1:[],2:[]};
    for(const loc of locations){
      const p=point(loc.location_id),isActive=loc.location_id===current;
      const tone=isActive?active:(anomaliesByLocation.has(loc.location_id)?warning:normal);
      const height=.27+(anomaliesByLocation.get(loc.location_id)||0)*.08;
      const mass=box(.86,height,.63,room,p.x,height/2+.04,p.z);mass.userData.location=loc;pickables.push(mass);
      const marker=box(.38,.13,.38,tone,p.x,height+.15,p.z);marker.userData.location=loc;pickables.push(marker);
      const sprite=labelSprite(loc.location_id,isActive);sprite.position.set(p.x,height+.58,p.z);sprite.userData.location=loc;scene.add(sprite);pickables.push(sprite);textures.push(sprite.material.map);materials.push(sprite.material);
      floorGroups[loc.floor]?.push(mass,marker,sprite);
    }
    const routes={};
    for(const number of ['1','2']){
      const routePoints=actions.filter(a=>locationById.get(a.location_id)?.floor===number).map(a=>point(a.location_id).setY(.16));
      if(routePoints.length>1){const curve=new THREE.BufferGeometry().setFromPoints(routePoints);geometry.push(curve);const routeMaterial=new THREE.LineBasicMaterial({color:'#48c9ee',transparent:true,opacity:.85});materials.push(routeMaterial);const line=new THREE.Line(curve,routeMaterial);scene.add(line);routes[number]=line;}
    }
    const grid=new THREE.GridHelper(17,18,'#31536d','#20384b');grid.position.y=-.26;scene.add(grid);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const click=e=>{const bounds=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-bounds.left)/bounds.width*2-1;pointer.y=-(e.clientY-bounds.top)/bounds.height*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(pickables)[0];if(hit?.object.userData.location)selectRef.current(hit.object.userData.location);};
    renderer.domElement.addEventListener('click',click);
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let running=true;const frame=()=>{if(!running)return;controls.update();renderer.render(scene,camera);requestAnimationFrame(frame);};frame();
    const setFloor=value=>{for(const [f,objects] of Object.entries(floorGroups))for(const o of objects)o.visible=value==='all'||value===f;for(const [f,plane] of Object.entries(floorMeshes))plane.visible=value==='all'||value===f;for(const [f,line] of Object.entries(routes))line.visible=value==='all'||value===f;controls.target.set(value==='1'?-2.6:value==='2'?5.3:0,0,0);camera.position.set(controls.target.x+1.5,13,17);controls.update();};
    apiRef.current.setFloor=setFloor;
    setFloor(floor);
    return()=>{running=false;observer.disconnect();renderer.domElement.removeEventListener('click',click);controls.dispose();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();renderer.dispose();renderer.domElement.remove();apiRef.current=null;};
  },[locations,actions,current]);

  useEffect(()=>{apiRef.current?.setFloor?.(floor);},[floor]);
  const reset=()=>{const api=apiRef.current;if(!api)return;api.controls.target.set(floor==='1'?-2.6:floor==='2'?5.3:0,0,0);api.camera.position.set(api.controls.target.x+1.5,13,17);api.controls.update();};
  return <div className="facility-3d">
    <div className="facility-3d-canvas" ref={hostRef} aria-label="Interactive schematic 3D facility map" role="img"/>
    {error?<p role="alert" className="facility-3d-error">{error}</p>:<div className="facility-3d-hint">Drag to rotate · Scroll to zoom · Click a cube or label to inspect</div>}
    <button className="facility-3d-reset" onClick={reset}>Reset view</button>
    <div className="facility-3d-list" aria-label="Accessible waypoint list">{locations.filter(l=>floor==='all'||l.floor===floor).map(l=><button key={l.location_id} onClick={()=>onSelect(l)} className={l.location_id===current?'current':''}>{l.location_id} <span>{l.location_name}</span></button>)}</div>
  </div>;
}
