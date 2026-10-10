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
import {sampleReplay,stepManual,angleDelta,worldPoint,stamp,recoveryRoute,pointOnPath,nextVisit,sourceTime} from './replay-engine.mjs';

import {createMissionMarkers} from './mission-markers.js';
import {waypointFloor,floorAt} from './facility-layout.mjs';

RectAreaLightUniformsLib.init();

export default function SpotReplayScene({replay,route=replay,locations,anomalies,state,cameraMode,stopToken,selectedAnomaly,onAnomaly,onTelemetry,floor='all',selectedLocation,onSelect,onRecovery,overview=false,showLabels=true,showPath=true,roofMode='cutaway',cameraResetToken=0}) {
  const hostRef=useRef(null),latest=useRef({}),[error,setError]=useState(''),[assetStatus,setAssetStatus]=useState({loaded:0,total:11,failed:[]});
  latest.current={replay,state,cameraMode,stopToken,selectedAnomaly,onAnomaly,onTelemetry,floor,selectedLocation,onSelect,onRecovery,showLabels,showPath,roofMode,cameraResetToken};
  useEffect(()=>{
    const host=hostRef.current;let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D graphics unavailable. Enable hardware acceleration to use the simulator.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#45545c');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.fog=new THREE.Fog('#45545c',55,145);scene.add(new THREE.HemisphereLight('#dce8ed','#77776b',1.15));
    const sun=new THREE.DirectionalLight('#ffedda',1.65);sun.position.set(-15,30,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.far=100;sun.shadow.bias=-.00025;sun.shadow.normalBias=.012;scene.add(sun);
    const camera=new THREE.PerspectiveCamera(55,1,.18,180),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=overview?120:60;controls.maxPolarAngle=Math.PI/2-.06;controls.enablePan=false;
    const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),backend=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    const resources=[],environment=createReplayEnvironment(scene,resources,locations,setAssetStatus),{solids}=environment;
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),reflections=pmrem.fromScene(room,.05);scene.environment=reflections.texture;scene.environmentIntensity=.55;resources.push(reflections);room.dispose();pmrem.dispose();
    const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});renderTarget.samples=2;
    const composer=new EffectComposer(renderer,renderTarget),renderPass=new RenderPass(scene,camera),ao=new GTAOPass(scene,camera,1,1),output=new OutputPass();
    ao.updateGtaoMaterial({radius:.42,thickness:.8,distanceExponent:1.6});ao.blendIntensity=.32;
    composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);
    const robot=createSpot(resources);robot.scale.setScalar(1.3);robot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(robot);
    const initial=sampleReplay(replay,latest.current.state.time);robot.position.set(initial.x,0,initial.z);robot.rotation.y=initial.yaw;controls.target.set(initial.x,.7,initial.z);camera.position.set(initial.x-6,3.5,initial.z);controls.update();
    const missionMarkers=createMissionMarkers(scene,resources,locations,route);
    const flags=anomalies.map(a=>{
      const p=worldPoint(a.location_id),geo=new THREE.ConeGeometry(.25,.6,4),mat=new THREE.MeshBasicMaterial({color:a.severity==='CRITICAL'?'#ff718b':'#ffc65e'});resources.push(geo,mat);
      const flag=new THREE.Mesh(geo,mat);flag.position.set(p.x,1.9,p.z);flag.userData.anomaly=a;scene.add(flag);return flag;
    });
    let dragging=false;const chaseOffset=new THREE.Vector3(-6,3,0);let resetSeen=-1,transitionStart=0,transitionFrom=new THREE.Vector3(),transitionTo=new THREE.Vector3(),transitionActive=false,frames=0,statsStart=performance.now(),renderMs=0;let diagnosticAt=0;controls.addEventListener('start',()=>{dragging=true});controls.addEventListener('end',()=>{chaseOffset.copy(camera.position).sub(controls.target);dragging=false});
    const keys=new Set();const handled=new Set(['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright',' ']);
    const keydown=e=>{if(!latest.current.state.manual||document.activeElement!==host)return;const key=e.key.toLowerCase();if(handled.has(key)){e.preventDefault();keys.add(key);}};
    const keyup=e=>keys.delete(e.key.toLowerCase()),clear=()=>keys.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);host.addEventListener('blur',clear);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    const pointerDown=e=>{host.focus({preventScroll:true});down=[e.clientX,e.clientY]};
    const click=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(flags.filter(f=>f.visible))[0];if(hit)latest.current.onAnomaly(hit.object.userData.anomaly);else {const marker=raycaster.intersectObjects(missionMarkers.pickables.filter(o=>o.visible))[0];if(marker)latest.current.onSelect?.(marker.object.userData.location);}};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('click',click);
    const resize=()=>{if(!host.clientWidth||!host.clientHeight)return;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight,false);composer.setSize(host.clientWidth,host.clientHeight);ao.setSize(Math.max(1,Math.floor(host.clientWidth*.65)),Math.max(1,Math.floor(host.clientHeight*.65)));};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    let manualPose={...initial,speed:0},wasManual=false,lastMode='',lastYaw=initial.yaw,lastStop=-1,last=performance.now(),telemetryAt=0,frameId,topHeight=28,slowFrames=0,lastRobotX=initial.x,lastRobotZ=initial.z,recovery=null,recoveryDistance=0,heldPose=null,lastFloor='';
    host.__resetSpotStats=()=>{frames=0;statsStart=performance.now();renderMs=0;};
    const wheel=e=>{const mode=latest.current.cameraMode;if(mode==='top'){e.preventDefault();topHeight=THREE.MathUtils.clamp(topHeight+e.deltaY*.02,8,65);}else if(mode==='chase'){e.preventDefault();chaseOffset.multiplyScalar(THREE.MathUtils.clamp(1+e.deltaY*.001,.8,1.2));chaseOffset.clampLength(2,60);}else if(mode==='first'){e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.015,30,85);camera.updateProjectionMatrix();}};
    renderer.domElement.addEventListener('wheel',wheel,{passive:false});
    const direction=new THREE.Vector3(),target=new THREE.Vector3(),desired=new THREE.Vector3(),offset=new THREE.Vector3(),cameraRay=new THREE.Raycaster();
    const frame=()=>{
      const now=performance.now(),elapsed=(now-last)/1000,dt=Math.min(elapsed,.05);last=now;
      // Drop the optional AO pass if this device consistently misses real-time frames.
      // Navigation and telemetry remain responsive on integrated/mobile GPUs.
      slowFrames=elapsed>.045?slowFrames+1:Math.max(0,slowFrames-2);
      if(slowFrames>8||(elapsed>.1&&now-statsStart>2000))ao.enabled=false;
      const live=latest.current,{state:s}=live,replay=live.replay,mode=live.roofMode==='overhead'?'top':live.cameraMode,recorded=sampleReplay(replay,s.time);
            if(lastStop!==live.stopToken){keys.clear();manualPose.speed=0;heldPose=null;lastStop=live.stopToken;}
      if(s.manual&&!wasManual){manualPose={...recorded,x:robot.position.x,z:robot.position.z,yaw:robot.rotation.y,floor:floorAt(robot.position.x,robot.position.z),speed:0};host.focus({preventScroll:true});}
      if(!s.manual&&wasManual){keys.clear();if(s.recovering){host.__recoveryPlans=(host.__recoveryPlans||0)+1;recovery=recoveryRoute(replay,s.time,manualPose);recoveryDistance=0;if(!recovery||recovery.unreachable){live.onRecovery?.({error:recovery?.transfer?'Cross-floor connection is not provided in the reference. Return to Replay or seek to the next floor.':'No reachable unfinished inspection from this position.',time:s.time});heldPose={...manualPose,speed:0};recovery=null;}}else recovery=null;}wasManual=s.manual;
      if(!s.recovering)recovery=null;
      environment.setFloor(live.floor);environment.setRoof(live.roofMode,mode,dt);
      if(live.floor!==lastFloor){if(live.floor!=='all'){const center=live.floor==='1'?new THREE.Vector3(-13,.75,0):new THREE.Vector3(28,.75,0);if(mode==='free'){controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,54,32));}}lastFloor=live.floor;}


      if(s.manual&&(live.floor==='all'||live.floor===floorAt(manualPose.x,manualPose.z)))manualPose=stepManual(manualPose,{forward:keys.has('w')||keys.has('arrowup')?1:0,backward:keys.has('s')||keys.has('arrowdown')?1:0,left:keys.has('a')||keys.has('arrowleft')?1:0,right:keys.has('d')||keys.has('arrowright')?1:0,stop:keys.has(' ')},dt);
      let recoveredPose=null;
      if(recovery&&s.recovering){if(s.playing)recoveryDistance=Math.min(recovery.length,recoveryDistance+dt*1.5*s.speed);recoveredPose={...pointOnPath(recovery,recoveryDistance),floor:floorAt(manualPose.x,manualPose.z),speed:s.playing?1.5:0,destination:recovery.visit.location_id,location_id:manualPose.location_id};if(recoveryDistance>=recovery.length){heldPose=null;live.onRecovery?.({time:recovery.time});}}
      const pose=s.manual?manualPose:recoveredPose||heldPose||recorded,moving=s.manual?Math.abs(pose.speed)>.02:s.playing&&pose.speed>.001&&!pose.transfer;
      robot.position.set(pose.x,0,pose.z);if(s.manual||pose.speed>.001)robot.rotation.y+=angleDelta(robot.rotation.y,pose.yaw)*(1-Math.exp(-dt*9));
      const gaitSpeed=moving?(s.manual?pose.speed:Math.hypot(pose.x-lastRobotX,pose.z-lastRobotZ)/Math.max(dt,.001)):0;
      updateSpotGait(robot,dt,Math.sign(gaitSpeed)*Math.min(2.2,Math.abs(gaitSpeed)));lastRobotX=pose.x;lastRobotZ=pose.z;
      target.set(pose.x,.75,pose.z);if(live.floor!=='all'&&live.floor!==(pose.floor||floorAt(pose.x,pose.z)))target.set(live.floor==='1'?-13:28,.75,0);direction.set(Math.cos(robot.rotation.y),0,-Math.sin(robot.rotation.y));
      if(mode!==lastMode||resetSeen!==live.cameraResetToken){resetSeen=live.cameraResetToken;transitionFrom.copy(camera.position);transitionStart=now;transitionActive=true;camera.up.set(0,1,0);camera.fov=55;camera.updateProjectionMatrix();controls.enabled=mode==='chase'||mode==='free';controls.enablePan=mode==='free';controls.minDistance=(mode==='free'&&!overview) ? .75 : 2;controls.maxPolarAngle=mode==='free'?Math.PI*.8:Math.PI/2-.06;controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(-6*direction.x,3,-6*direction.z));if(!overview&&mode==='free'){controls.target.y=2.9;camera.position.copy(target).add(new THREE.Vector3(-8*direction.x,.9,-8*direction.z));}if(overview&&mode==='free'){controls.target.set(live.floor==='2'?28:live.floor==='1'?-13:0,.5,0);camera.position.set(controls.target.x,68,45);}controls.update();transitionTo.copy(camera.position);chaseOffset.copy(camera.position).sub(controls.target);lastMode=mode;lastYaw=robot.rotation.y;}
      if(mode==='chase'){
        if(dragging)chaseOffset.copy(camera.position).sub(controls.target);offset.copy(chaseOffset);if(!dragging)offset.applyAxisAngle(new THREE.Vector3(0,1,0),angleDelta(lastYaw,robot.rotation.y));
        chaseOffset.copy(offset);controls.target.lerp(target,1-Math.exp(-dt*10));desired.copy(controls.target).add(offset);
        cameraRay.set(controls.target,offset.clone().normalize());cameraRay.far=offset.length();const hit=cameraRay.intersectObjects(solids.filter(o=>o.userData.floor===(pose.floor||floorAt(pose.x,pose.z))))[0];if(hit&&hit.distance>1)desired.copy(controls.target).addScaledVector(offset.clone().normalize(),Math.max(1,hit.distance-.3));camera.position.lerp(desired,1-Math.exp(-dt*10));camera.lookAt(controls.target);
      }else if(mode==='top'){desired.set(target.x,topHeight,target.z+.01);camera.position.lerp(desired,1-Math.exp(-dt*9));camera.up.set(0,0,-1);camera.lookAt(target);}
      else if(mode==='first'){camera.up.set(0,1,0);camera.position.copy(target).addScaledVector(direction,.85);camera.position.y=1.05;camera.lookAt(target.clone().addScaledVector(direction,8));}
      else {camera.up.set(0,1,0);controls.update();camera.position.y=Math.max(.25,camera.position.y);

      }
      if(transitionActive){const f=Math.min(1,(now-transitionStart)/450),destination=mode==='free'?transitionTo:mode==='chase'?desired:mode==='top'?new THREE.Vector3(target.x,topHeight,target.z+.01):camera.position.clone();camera.position.lerpVectors(transitionFrom,destination,f*f*(3-2*f));if(f===1)transitionActive=false;camera.lookAt(mode==='first'?target.clone().addScaledVector(direction,8):controls.target);}if(mode==='free'&&!overview){offset.copy(camera.position).sub(controls.target);cameraRay.set(controls.target,offset.clone().normalize());cameraRay.far=offset.length();const hit=cameraRay.intersectObjects(solids.filter(o=>o.userData.floor===floorAt(controls.target.x,controls.target.z)))[0];if(hit&&hit.distance>.6){camera.position.copy(controls.target).addScaledVector(offset.normalize(),Math.max(.5,hit.distance-.25));camera.lookAt(controls.target);}}if(mode!=='top')camera.up.set(0,1,0);lastYaw=robot.rotation.y;robot.visible=replay.visits.length>0&&mode!=='first'&&!pose.transfer&&(live.floor==='all'||live.floor===(pose.floor||floorAt(pose.x,pose.z)));
      missionMarkers.update({time:s.time,floor:live.floor,playing:s.playing,manual:s.manual,recovering:s.recovering,selected:live.selectedLocation,anomalies,destination:pose.destination||nextVisit(replay,s.time)?.location_id,camera,now,showLabels:live.showLabels,sourceTime:sourceTime(replay,s.time),showPath:live.showPath,timeline:replay});
      for(const flag of flags){const a=flag.userData.anomaly;flag.visible=(live.floor==='all'||live.floor===waypointFloor(a.location_id))&&(stamp(a.timestamp)<=replay.start+sourceTime(replay,s.time)*1000||a.anomaly_id===live.selectedAnomaly?.anomaly_id);flag.scale.setScalar(a.anomaly_id===live.selectedAnomaly?.anomaly_id?1.6:1);}
      if(now-telemetryAt>100){live.onTelemetry({...pose,floor:pose.floor||floorAt(pose.x,pose.z),walking:moving,recovering:!!recoveredPose,held:!!heldPose});telemetryAt=now;}
      const renderStart=performance.now();renderer.info.autoReset=false;renderer.info.reset();composer.render();renderMs+=performance.now()-renderStart;frames++;
      if(now-diagnosticAt>500){host.__spotDiagnostics={route:missionMarkers.path.snapshot(),roof:live.roofMode,ao:ao.enabled,camera:{near:camera.near,far:camera.far,position:camera.position.toArray(),target:controls.target.toArray(),mode},render:{backend,fps:frames*1000/Math.max(1,now-statsStart),cpuMs:renderMs/frames,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},pose:{x:pose.x,z:pose.z,yaw:robot.rotation.y},timeline:{time:s.time,duration:replay.duration,mode:s.mode,source:sourceTime(replay,s.time)},recoveryPlans:host.__recoveryPlans||0};diagnosticAt=now;}
      frameId=requestAnimationFrame(frame);
    };frame();
    return()=>{cancelAnimationFrame(frameId);environment.dispose();observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);host.removeEventListener('blur',clear);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('click',click);renderer.domElement.removeEventListener('wheel',wheel);controls.dispose();ao.dispose();ao.gtaoMaterial.dispose();ao.blendMaterial.dispose();output.dispose();composer.dispose();sun.shadow.dispose();for(const r of new Set(resources))r.dispose();renderer.dispose();renderer.domElement.remove();delete host.__resetSpotStats;delete host.__spotDiagnostics;delete host.__recoveryPlans;};
  },[route,locations,anomalies,overview]);
  return <div ref={hostRef} className="spot-replay-canvas" tabIndex={0} role="region" aria-label="Spot simulation viewport. In manual mode focus here and use WASD or arrow keys; Space stops.">{error&&<p className="spot-replay-error" role="alert">{error}</p>}{assetStatus.loaded<assetStatus.total&&<span className="industrial-loading" role="status">Loading plant details · {assetStatus.loaded}/{assetStatus.total}</span>}{assetStatus.loaded===assetStatus.total&&assetStatus.failed.length>0&&<span className="industrial-loading" role="status">Some model details unavailable · procedural equipment active</span>}</div>;
}
