import * as THREE from 'three';
import {SPOT_DIMENSIONS,SPOT_COLLISION} from './spot-collision.mjs';

export function calibrateSpot(visual){
 const root=new THREE.Group();root.name='SPOT calibrated physical pose';
 // Bounds measured across a complete forward/reverse articulated gait cycle.
 visual.scale.set(SPOT_DIMENSIONS.length/.938,SPOT_DIMENSIONS.walkingHeight/.639,SPOT_DIMENSIONS.width/.427);
 visual.position.x=-.02*visual.scale.x;root.add(visual);root.userData=visual.userData;root.userData.visual=visual;return root;
}

export function createSpotHitbox(robot,resources){
 const box=new THREE.BoxGeometry(SPOT_COLLISION.length,SPOT_COLLISION.height,SPOT_COLLISION.width),edges=new THREE.EdgesGeometry(box),material=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.68,depthWrite:false});box.dispose();resources.push(edges,material);
 const outline=new THREE.LineSegments(edges,material);outline.name='SPOT collision boundary';outline.position.y=SPOT_COLLISION.height/2+.012;outline.userData.dimensions=SPOT_COLLISION;robot.add(outline);return outline;
}
