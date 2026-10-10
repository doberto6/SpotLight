import * as THREE from 'three';

export function createSpot(resources) {
  const robot=new THREE.Group(),legs=[];
  const part=(size,color,position,parent=robot)=>{
    const geometry=new THREE.BoxGeometry(...size),material=new THREE.MeshStandardMaterial({color,roughness:.55});
    resources.push(geometry,material);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh;
  };
  part([.65,.2,.3],'#f7c547',[0,.43,0]);
  part([.4,.07,.22],'#283443',[0,.57,0]);
  part([.16,.15,.28],'#f7c547',[.36,.45,0]);
  part([.03,.08,.2],'#15202d',[.45,.46,0]);
  for(const x of [-.24,.24])for(const z of [-.17,.17]){
    const leg=new THREE.Group();leg.position.set(x,.4,z);robot.add(leg);
    part([.055,.2,.065],'#e2af2b',[0,-.1,0],leg);
    part([.04,.18,.045],'#263345',[.025,-.28,0],leg);
    part([.09,.035,.075],'#101820',[.025,-.38,0],leg);legs.push(leg);
  }
  robot.userData.legs=legs;return robot;
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
