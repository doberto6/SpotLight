import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createSpot,updateSpotGait} from './spot-scene.js';
import {createReplayEnvironment} from './replay-environment.js';
import {sampleReplay,stepManual,angleDelta,worldPoint,stamp} from './replay-engine.mjs';

RectAreaLightUniformsLib.init();

export default function SpotReplayScene({replay,locations,anomalies,state,cameraMode,stopToken,selectedAnomaly,onAnomaly,onTelemetry}) {
  const hostRef=useRef(null),latest=useRef({}),[error,setError]=useState(''),[assetStatus,setAssetStatus]=useState({loaded:0,total:10,failed:[]});
  latest.current={state,cameraMode,stopToken,selectedAnomaly,onAnomaly,onTelemetry};
  useEffect(()=>{
    const host=hostRef.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D graphics unavailable. Enable hardware acceleration to use the simulator.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#45545c');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.fog=new THREE.Fog('#45545c',55,145);scene.add(new THREE.HemisphereLight('#dce8ed','#4c5150',.65));
    const sun=new THREE.DirectionalLight('#ffedda',2.4);sun.position.set(-15,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.far=100;sun.shadow.bias=-.00025;sun.shadow.normalBias=.025;scene.add(sun);
    for(const x of [-28,-12,4,26]){const light=new THREE.RectAreaLight('#e8f3f0',1.4,12,16);light.position.set(x,6.35,0);light.rotation.x=-Math.PI/2;scene.add(light);}
    const camera=new THREE.PerspectiveCamera(55,1,.08,180),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=60;controls.maxPolarAngle=Math.PI/2-.06;controls.enablePan=false;
    const resources=[],environment=createReplayEnvironment(scene,resources,locations,setAssetStatus),{solids}=environment;
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),reflections=pmrem.fromScene(room,.05);scene.environment=reflections.texture;scene.environmentIntensity=.55;resources.push(reflections);room.dispose();pmrem.dispose();
    const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});renderTarget.samples=2;
    const composer=new EffectComposer(renderer,renderTarget),renderPass=new RenderPass(scene,camera),ao=new GTAOPass(scene,camera,1,1),output=new OutputPass();
    ao.updateGtaoMaterial({radius:.42,thickness:.8,distanceExponent:1.6});ao.blendIntensity=.32;
    composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);
    const robot=createSpot(resources);robot.scale.setScalar(2.2);robot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(robot);
    const initial=sampleReplay(replay,latest.current.state.time);robot.position.set(initial.x,0,initial.z);robot.rotation.y=initial.yaw;controls.target.set(initial.x,.7,initial.z);camera.position.set(initial.x-6,3.5,initial.z);controls.update();
    const flags=anomalies.map(a=>{
      const p=worldPoint(a.location_id),geo=new THREE.ConeGeometry(.25,.6,4),mat=new THREE.MeshBasicMaterial({color:a.severity==='CRITICAL'?'#ff718b':'#ffc65e'});resources.push(geo,mat);
      const flag=new THREE.Mesh(geo,mat);flag.position.set(p.x,1.9,p.z);flag.userData.anomaly=a;scene.add(flag);return flag;
    });
    let dragging=false;controls.addEventListener('start',()=>{dragging=true});controls.addEventListener('end',()=>{dragging=false});
    const keys=new Set();const handled=new Set(['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright',' ']);
    const keydown=e=>{if(!latest.current.state.manual||document.activeElement!==host)return;const key=e.key.toLowerCase();if(handled.has(key)){e.preventDefault();keys.add(key);}};
    const keyup=e=>keys.delete(e.key.toLowerCase()),clear=()=>keys.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    const pointerDown=e=>{host.focus({preventScroll:true});down=[e.clientX,e.clientY]};
    const click=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(flags.filter(f=>f.visible))[0];if(hit)latest.current.onAnomaly(hit.object.userData.anomaly);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('click',click);
    const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);composer.setSize(host.clientWidth,host.clientHeight);ao.setSize(Math.max(1,Math.floor(host.clientWidth*.65)),Math.max(1,Math.floor(host.clientHeight*.65)));};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let manualPose={...initial,speed:0},wasManual=false,lastMode='',lastYaw=initial.yaw,lastStop=-1,last=performance.now(),telemetryAt=0,frameId,topHeight=28,slowFrames=0,lastRobotX=initial.x,lastRobotZ=initial.z;
    const wheel=e=>{const mode=latest.current.cameraMode;if(mode==='top'){e.preventDefault();topHeight=THREE.MathUtils.clamp(topHeight+e.deltaY*.02,8,65);}else if(mode==='first'){e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.015,30,85);camera.updateProjectionMatrix();}};
    renderer.domElement.addEventListener('wheel',wheel,{passive:false});
    const direction=new THREE.Vector3(),target=new THREE.Vector3(),desired=new THREE.Vector3(),offset=new THREE.Vector3(),cameraRay=new THREE.Raycaster();
    const frame=()=>{
      const now=performance.now(),elapsed=(now-last)/1000,dt=Math.min(elapsed,.05);last=now;
      // Drop the optional AO pass if this device consistently misses real-time frames.
      // Navigation and telemetry remain responsive on integrated/mobile GPUs.
      slowFrames=elapsed>.045?slowFrames+1:Math.max(0,slowFrames-2);
      if(slowFrames>30)ao.enabled=false;
      const live=latest.current,{state:s,cameraMode:mode}=live,recorded=sampleReplay(replay,s.time);
      if(s.manual&&!wasManual){manualPose={...recorded,speed:0};host.focus({preventScroll:true});}
      if(!s.manual&&wasManual)keys.clear();wasManual=s.manual;
      if(lastStop!==live.stopToken){keys.clear();manualPose.speed=0;lastStop=live.stopToken;}
      if(s.manual)manualPose=stepManual(manualPose,{forward:keys.has('w')||keys.has('arrowup')?1:0,backward:keys.has('s')||keys.has('arrowdown')?1:0,left:keys.has('a')||keys.has('arrowleft')?1:0,right:keys.has('d')||keys.has('arrowright')?1:0,stop:keys.has(' ')},dt);
      const pose=s.manual?manualPose:recorded,moving=s.manual?Math.abs(pose.speed)>.02:s.playing&&pose.speed>.001;
      robot.position.set(pose.x,0,pose.z);robot.rotation.y+=angleDelta(robot.rotation.y,pose.yaw)*(1-Math.exp(-dt*9));
      const gaitSpeed=moving?(s.manual?pose.speed:Math.hypot(pose.x-lastRobotX,pose.z-lastRobotZ)/Math.max(dt,.001)):0;
      updateSpotGait(robot,dt,gaitSpeed);lastRobotX=pose.x;lastRobotZ=pose.z;
      target.set(pose.x,.75,pose.z);direction.set(Math.cos(robot.rotation.y),0,-Math.sin(robot.rotation.y));
      if(mode!==lastMode){camera.up.set(0,1,0);camera.fov=55;camera.updateProjectionMatrix();controls.enabled=mode==='chase'||mode==='free';controls.enablePan=mode==='free';controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(-6*direction.x,3,-6*direction.z));controls.update();lastMode=mode;lastYaw=robot.rotation.y;}
      if(mode==='chase'){
        offset.copy(camera.position).sub(controls.target);if(!dragging)offset.applyAxisAngle(new THREE.Vector3(0,1,0),angleDelta(lastYaw,robot.rotation.y));
        controls.target.lerp(target,1-Math.exp(-dt*10));camera.position.copy(controls.target).add(offset);controls.update();
        cameraRay.set(controls.target,offset.clone().normalize());cameraRay.far=offset.length();const hit=cameraRay.intersectObjects(solids)[0];if(hit&&hit.distance>1)camera.position.copy(controls.target).addScaledVector(offset.clone().normalize(),Math.max(1,hit.distance-.3));
      }else if(mode==='top'){desired.set(pose.x,topHeight,pose.z+.01);camera.position.lerp(desired,1-Math.exp(-dt*9));camera.up.set(0,0,-1);camera.lookAt(target);}
      else if(mode==='first'){camera.up.set(0,1,0);camera.position.copy(target).addScaledVector(direction,.85);camera.position.y=1.05;camera.lookAt(target.clone().addScaledVector(direction,8));}
      else {camera.up.set(0,1,0);controls.update();}
      if(mode!=='top')camera.up.set(0,1,0);lastYaw=robot.rotation.y;robot.visible=mode!=='first';
      for(const flag of flags){const a=flag.userData.anomaly;flag.visible=stamp(a.timestamp)<=replay.start+s.time*1000||a.anomaly_id===live.selectedAnomaly?.anomaly_id;flag.scale.setScalar(a.anomaly_id===live.selectedAnomaly?.anomaly_id?1.6:1);}
      if(now-telemetryAt>100){live.onTelemetry({...pose,walking:moving});telemetryAt=now;}
      composer.render();frameId=requestAnimationFrame(frame);
    };frame();
    return()=>{cancelAnimationFrame(frameId);environment.dispose();observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('click',click);renderer.domElement.removeEventListener('wheel',wheel);controls.dispose();ao.dispose();ao.gtaoMaterial.dispose();ao.blendMaterial.dispose();output.dispose();composer.dispose();sun.shadow.dispose();for(const r of new Set(resources))r.dispose();renderer.dispose();renderer.domElement.remove();};
  },[replay,locations,anomalies]);
  return <div ref={hostRef} className="spot-replay-canvas" tabIndex={0} role="region" aria-label="Spot simulation viewport. In manual mode focus here and use WASD or arrow keys; Space stops.">{error&&<p className="spot-replay-error" role="alert">{error}</p>}{assetStatus.loaded<assetStatus.total&&<span className="industrial-loading" role="status">Loading plant details · {assetStatus.loaded}/{assetStatus.total}</span>}{assetStatus.loaded===assetStatus.total&&assetStatus.failed.length>0&&<span className="industrial-loading" role="status">Some model details unavailable · procedural equipment active</span>}</div>;
}
