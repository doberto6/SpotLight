import * as THREE from 'three';

// Poly Haven concrete_floor, CC0: three 1K maps, source scale 2.08 metres.
// Geometry UVs are world metres, including the registered floor polygon.
export function industrialFloorMaps(resources){
  const loader=new THREE.TextureLoader(),maps={};
  for(const [slot,file] of [['map','diffuse'],['roughnessMap','roughness'],['normalMap','normal']]){
    const texture=loader.load('/textures/concrete_floor/'+file+'.jpg');
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/2.08,1/2.08);texture.anisotropy=4;
    if(slot==='map')texture.colorSpace=THREE.SRGBColorSpace;
    resources.push(texture);maps[slot]=texture;
  }
  return {...maps,normalScale:new THREE.Vector2(.18,.18)};
}

// Small deterministic tiles: no network dependency, subtle pores and aggregate,
// and linear roughness/normal data rather than color used as a lighting map.
export function concreteMaps(resources,repeat=[20,12],{joints=true,base=165,normalStrength=.32}={}) {
  const size=256,heights=new Float32Array(size*size);let seed=713;
  for(let i=0;i<heights.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;heights[i]=(seed%101)/100;}
  const make=(paint,color=false)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x,rgb=paint(x,y,i);pixels.data.set([...rgb,255],i*4);
    }
    ctx.putImageData(pixels,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(...repeat);texture.anisotropy=4;
    if(color)texture.colorSpace=THREE.SRGBColorSpace;
    resources.push(texture);return texture;
  };
  const map=make((x,y,i)=>{
    const joint=joints&&(x<1||y<1)?-.15:0;
    const clouds=Math.sin(x*.065)*Math.cos(y*.04)*4;
    const v=base+heights[i]*10+clouds+joint*120;
    return [v,v+1,v-2];
  },true);
  const roughnessMap=make((x,y,i)=>{const v=225+heights[i]*24;return [v,v,v]});
  const normalMap=make((x,y,i)=>{
    const dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size];
    const dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
    return [128+dx*12,128+dy*12,254];
  });
  return {map,roughnessMap,normalMap,normalScale:new THREE.Vector2(normalStrength,normalStrength)};
}
