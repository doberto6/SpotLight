import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Homepage concept model. The inspection/replay robot keeps its original model.
export function createSketchSpot(resources){
  const robot=new THREE.Group();robot.name='Spot from the team drawing';
  const keep=value=>{resources.push(value);return value;};
  // A repeatable pencil fill drawn on a canvas, wrapped around the actual geometry.
  let seed=236;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f3e8';ctx.fillRect(0,0,512,512);
  for(let i=0;i<6500;i++){
    const x=random()*512,y=random()*512;
    ctx.strokeStyle=random()>.45?'rgba(55,48,32,.12)':'rgba(255,255,255,.65)';
    ctx.lineWidth=.5+random()*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4+random()*22,y-2-random()*9);ctx.stroke();
  }
  for(let i=0;i<15000;i++){ctx.fillStyle=`rgba(45,40,30,${random()*.15})`;ctx.fillRect(random()*512,random()*512,1,1);}
  const pencil=keep(new THREE.CanvasTexture(canvas));pencil.colorSpace=THREE.SRGBColorSpace;pencil.anisotropy=4;
  const yellow=keep(new THREE.MeshToonMaterial({color:'#efc837',map:pencil}));
  const charcoal=keep(new THREE.MeshToonMaterial({color:'#43464c',map:pencil}));
  const gray=keep(new THREE.MeshToonMaterial({color:'#b6b8b7',map:pencil}));
  const lens=keep(new THREE.MeshToonMaterial({color:'#17232a'}));
  const ink=keep(new THREE.MeshBasicMaterial({color:'#252a30',side:THREE.BackSide}));
  const graphite=keep(new THREE.MeshBasicMaterial({color:'#3a3530',transparent:true,opacity:.78}));
  const softGraphite=keep(new THREE.MeshBasicMaterial({color:'#514936',transparent:true,opacity:.4}));
  const stroke=(points,parent,material=graphite,thickness=.0015)=>{
    const curve=new THREE.CatmullRomCurve3(points);
    const line=new THREE.Mesh(keep(new THREE.TubeGeometry(curve,points.length*3,thickness,4,false)),material);
    line.userData.outline=true;parent.add(line);
  };
  const add=(geometry,material,position,rotation=0)=>{
    keep(geometry);
    const group=new THREE.Group();group.position.set(...position);group.rotation.z=rotation;
    const fill=new THREE.Mesh(geometry,material);fill.castShadow=true;fill.receiveShadow=true;group.add(fill);
    const outline=new THREE.Mesh(geometry,ink);outline.scale.setScalar(1.045);outline.userData.outline=true;group.add(outline);
    robot.add(group);return group;
  };
  const box=(size,material,position,radius=.025)=>{
    const geometry=new RoundedBoxGeometry(...size,3,radius),vertices=geometry.attributes.position;
    // Smooth spatial wobble keeps shared vertices together, unlike random vertex noise.
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),a=Math.min(...size)*.035;
      vertices.setXYZ(i,x+Math.sin(y*67+z*31)*a,y+Math.sin(x*29+z*53)*a,z+Math.sin(x*37+y*41)*a*.5);
    }
    geometry.computeVertexNormals();
    const group=add(geometry,material,position);
    // Two slightly different pencil passes around the front face; no perfect CAD edges.
    for(const pass of [0,1]){
      const points=[],w=size[0]/2,h=size[1]/2,r=Math.min(radius,w*.6,h*.6);
      for(let corner=0;corner<4;corner++)for(let step=0;step<=6;step++){
        const angle=-Math.PI/2+corner*Math.PI/2+step/6*Math.PI/2;
        const cx=corner===0||corner===1?w-r:-w+r,cy=corner===0||corner===3?-h+r:h-r;
        const wobble=Math.min(...size)*.055;
        points.push(new THREE.Vector3(cx+Math.cos(angle)*r+(random()-.5)*wobble,cy+Math.sin(angle)*r+(random()-.5)*wobble,size[2]/2+.004+pass*.001));
      }
      points.push(points[0].clone());stroke(points,group,pass?softGraphite:graphite,pass?.0009:.0016);
    }
    // Sparse broken hatching follows the long body rather than covering it uniformly.
    if(size[0]>.4&&size[1]>.1)for(let i=0;i<26;i++){
      const x=-size[0]*.42+random()*size[0]*.82,y=-size[1]*.25+random()*size[1]*.5,z=size[2]/2+.008;
      stroke([new THREE.Vector3(x,y,z),new THREE.Vector3(x+.014,y+.013,z),new THREE.Vector3(x+.027,y+.023,z)],group,softGraphite,.0008);
    }
    return group;
  };
  const joint=(position,r=.035)=>{const g=add(new THREE.CylinderGeometry(r,r,.035,16),gray,position);g.rotation.x=Math.PI/2;};
  const limb=(a,b,width,material)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),middle=start.clone().add(end).multiplyScalar(.5);
    return add(new RoundedBoxGeometry(width,start.distanceTo(end),width,2,.012),material,middle.toArray(),Math.atan2(-(end.x-start.x),end.y-start.y));
  };
  // Long, almost rectangular torso, small snout, and broad gray vent from the sketch.
  box([.98,.205,.28],yellow,[0,.46,0],.055);
  box([.94,.03,.27],gray,[0,.35,0],.01);
  box([.125,.115,.18],yellow,[.545,.46,0],.027);
  box([.025,.105,.18],charcoal,[.617,.46,0],.012);
  for(const side of [-1,1]){
    box([.235,.09,.018],charcoal,[-.19,.465,side*.147],.012);
    box([.204,.067,.012],gray,[-.19,.465,side*.159],.008);
    for(const x of [-.245,-.185,-.125])box([.021,.068,.012],charcoal,[x,.465,side*.166],.004);
  }
  // Yellow equipment tray and square gray camera, rather than the original cylindrical sensor.
  box([.43,.032,.225],charcoal,[-.055,.58,0],.009);
  box([.285,.075,.19],yellow,[-.12,.624,0],.014);
  box([.135,.19,.13],gray,[.145,.68,0],.018);
  box([.14,.019,.14],charcoal,[.145,.78,0],.006);
  const camera=add(new THREE.CylinderGeometry(.033,.033,.016,20),lens,[.145,.653,.078]);camera.rotation.x=Math.PI/2;
  // Four chunky bent limbs hold the same playful walking stance as the drawing.
  const poses=[
    {hip:-.32,knee:-.41,foot:-.365,z:.15,lift:0},
    {hip:-.20,knee:-.075,foot:-.15,z:-.15,lift:.065},
    {hip:.23,knee:.355,foot:.275,z:.15,lift:.015},
    {hip:.36,knee:.47,foot:.43,z:-.15,lift:.08}
  ];
  for(const p of poses){
    const hip=[p.hip,.36,p.z],knee=[p.knee,.205,p.z],foot=[p.foot,.035+p.lift,p.z];
    limb(hip,knee,.055,yellow);limb(knee,foot,.064,charcoal);
    joint(hip,.033);joint(knee,.031);box([.078,.039,.08],charcoal,foot,.013);
  }
  return robot;
}
