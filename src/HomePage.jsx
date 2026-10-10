import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {createSpot} from './spot-scene.js';
import './home.css';

function SpotPortrait(){
  const hostRef=useRef(null);const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    const host=hostRef.current,resources=[];let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setUnavailable(true);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#eef8ff','#53677e',3));
    const light=new THREE.DirectionalLight('#fff0cd',4);light.position.set(2,4,3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);scene.add(light);
    const robot=createSpot(resources);robot.rotation.y=-.2;robot.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(robot);
    const geometry=new THREE.PlaneGeometry(8,8),material=new THREE.ShadowMaterial({opacity:.25});resources.push(geometry,material);
    const ground=new THREE.Mesh(geometry,material);ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
    const camera=new THREE.PerspectiveCamera(32,1,.01,20);camera.position.set(1.4,.95,1.65);camera.lookAt(0,.3,0);
    const render=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.render(scene,camera);};
    const observer=new ResizeObserver(render);observer.observe(host);render();
    return()=>{observer.disconnect();resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="home-spot" ref={hostRef} role="img" aria-label="Yellow 3D SPOT inspection robot">{unavailable&&<p>3D preview unavailable on this device.</p>}</div>;
}

export default function HomePage(){
  return <section className="home-hero"><div className="home-copy"><small>SPOTLIGHT / ROBOTIC INSPECTION INTELLIGENCE</small><h1>Send SPOT.<br/>See what<br/><span>needs attention.</span></h1><p>Turn power plant inspections into clear maintenance decisions.</p></div><SpotPortrait/></section>;
}
