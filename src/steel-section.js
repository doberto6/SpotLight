import * as THREE from 'three';
// Closed I profile: a single extrusion avoids overlapping flange/web caps.
export function steelSection(width=.18,depth=.18,thickness=.025,rotate=false){
 const x=width/2,z=depth/2,t=thickness/2,points=[[-x,-z],[x,-z],[x,-z+thickness],[t,-z+thickness],[t,z-thickness],[x,z-thickness],[x,z],[-x,z],[-x,z-thickness],[-t,z-thickness],[-t,-z+thickness],[-x,-z+thickness]];
 const shape=new THREE.Shape(points.map(([a,b])=>new THREE.Vector2(...(rotate?[b,-a]:[a,b])))),geometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});geometry.rotateX(-Math.PI/2);return geometry;
}
