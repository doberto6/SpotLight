import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {legIK,footTarget,legLengths} from './spot-gait.mjs';

export function createSpot(resources) {
  const robot=new THREE.Group(),legs=[],joints=[],cache=new Map();robot.name='SPOT articulated inspection robot';
  const keep=r=>{resources.push(r);return r;};
  const yellow=keep(new THREE.MeshStandardMaterial({color:'#eebc37',metalness:.28,roughness:.46})),black=keep(new THREE.MeshStandardMaterial({color:'#20272b',metalness:.3,roughness:.67})),silver=keep(new THREE.MeshStandardMaterial({color:'#9da9b0',metalness:.86,roughness:.32})),rubber=keep(new THREE.MeshStandardMaterial({color:'#111719',roughness:.94})),glass=keep(new THREE.MeshStandardMaterial({color:'#142d36',metalness:.6,roughness:.12}));
  const mesh=(geometry,material,position,parent=robot)=>{const o=new THREE.Mesh(geometry,material);o.position.set(...position);parent.add(o);return o;};
  const part=(size,mat,pos,parent=robot)=>{
    const key=size.join(':');if(!cache.has(key))cache.set(key,keep(new RoundedBoxGeometry(...size,2,Math.min(...size)*.18)));
    return mesh(cache.get(key),mat,pos,parent);
  };
  const cylinder=keep(new THREE.CylinderGeometry(1,1,1,16)),ball=keep(new THREE.SphereGeometry(1,12,8));
  const joint=(r,h,pos,mat,parent=robot)=>{const o=mesh(cylinder,mat,pos,parent);o.scale.set(r,h,r);o.rotation.x=Math.PI/2;return o;};
  part([.69,.21,.32],yellow,[0,.455,0]);
  part([.59,.045,.29],black,[-.02,.349,0]);
  part([.4,.06,.25],black,[-.03,.585,0]);
  part([.32,.018,.21],yellow,[-.06,.62,0]);
  part([.18,.18,.3],yellow,[.36,.465,0]);
  part([.028,.105,.245],black,[.462,.475,0]);
  for(const z of [-.078,.078]){const lens=joint(.03,.018,[.48,.482,z],glass);lens.rotation.set(0,0,Math.PI/2);}
  for(const side of [-1,1]){
    part([.34,.084,.013],black,[-.08,.461,side*.167]);
    for(let x=-.19;x<.09;x+=.045)part([.012,.065,.006],silver,[x,.461,side*.177]);
    for(const x of [-.29,.27])joint(.011,.012,[x,.507,side*.166],silver);
  }
  part([.09,.1,.1],black,[.16,.643,0]);
  joint(.064,.075,[.16,.705,0],silver).rotation.set(0,0,0);
  part([.036,.021,.061],glass,[.206,.682,0]);
  for(const x of [-.19,.08])for(const z of [-.09,.09])joint(.009,.007,[x,.633,z],silver).rotation.set(0,0,0);
  for(const x of [-.24,.24])for(const z of [-.17,.17]){
    const leg=new THREE.Group();leg.position.set(x,.4,z);robot.add(leg);
    joint(.06,.075,[x,.4,z],black);
    joint(.043,.087,[0,0,0],yellow,leg);
    part([.048,legLengths.upper,.051],yellow,[0,-legLengths.upper/2,0],leg);
    part([.022,legLengths.upper*.65,.014],silver,[.024,-legLengths.upper*.5,0],leg);
    const knee=new THREE.Group();knee.position.y=-legLengths.upper;leg.add(knee);
    joint(.038,.072,[0,0,0],black,knee);
    part([.035,legLengths.lower,.037],black,[0,-legLengths.lower/2,0],knee);
    part([.011,legLengths.lower*.7,.04],silver,[-.022,-legLengths.lower/2,0],knee);
    const foot=new THREE.Group();foot.position.y=-legLengths.lower;knee.add(foot);
    const pad=mesh(ball,rubber,[0,0,0],foot);pad.scale.set(.04,.026,.034);
    legs.push(leg);joints.push({hip:leg,knee,foot});
  }
  robot.userData.legs=legs;robot.userData.joints=joints;robot.userData.gaitPhase=0;robot.userData.gaitBlend=0;
  updateSpotGait(robot,0,0);return robot;
}

export function updateSpotGait(robot,dt,speed) {
  const data=robot.userData,moving=Math.abs(speed)>.015;
  data.gaitBlend=THREE.MathUtils.lerp(data.gaitBlend,moving?1:0,1-Math.exp(-dt*14));
  // One cycle per 0.9 world metres: replay speed, reverse motion and manual
  // acceleration all drive the same diagonal trot rather than a fixed timer.
  if(moving)data.gaitPhase+=dt*Math.abs(speed)/.9*Math.PI*2;
  data.joints.forEach(({hip,knee,foot},i)=>{
    const target=footTarget(data.gaitPhase+(i===0||i===3?0:Math.PI),data.gaitBlend,Math.sign(speed)||1),angles=legIK(target.x,target.y);
    hip.rotation.z=angles.hip;knee.rotation.z=angles.knee;foot.rotation.z=-angles.hip-angles.knee;
  });
}

export function createRoom(scene,resources,p,loc) {
  const tall=loc.zone_type==='MECHANICAL',height=tall?.9:.6;
  const material=new THREE.MeshStandardMaterial({color:'#39536b',transparent:true,opacity:.32,roughness:.8});
  const geometry=new THREE.BoxGeometry(1.25,height,.85);resources.push(material,geometry);
  const room=new THREE.Mesh(geometry,material);room.position.set(p.x,height/2,p.z);room.userData.location=loc;scene.add(room);
  const edges=new THREE.EdgesGeometry(geometry),edgeMaterial=new THREE.LineBasicMaterial({color:'#6e91ae'});resources.push(edges,edgeMaterial);
  const outline=new THREE.LineSegments(edges,edgeMaterial);outline.position.copy(room.position);scene.add(outline);
  return {room,outline,height};
}
