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

// Shared world-scale painted plaster/steel finish. Gentle roller grain and
// narrow scuffs keep the plant maintained; roughness is independent of color.
export function paintedWallMaps(resources){
 const size=512,values=new Float32Array(size*size);let seed=9221;
 for(let i=0;i<values.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[i]=(seed%997)/997;}
 const make=(kind)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d'),pixels=c.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,n=values[i],cloud=Math.sin(x*.031+Math.sin(y*.024))*Math.cos(y*.018),scratch=x%137===0&&y%213<30;
   const rgb=kind==='color'?[242+cloud*5+n*5-(scratch?9:0),243+cloud*5+n*5-(scratch?9:0),240+cloud*5+n*5-(scratch?9:0)]:kind==='roughness'?[192+n*29,192+n*29,192+n*29]:[128+(values[y*size+(x+1)%size]-n)*8,128+(values[((y+1)%size)*size+x]-n)*8,254];
   pixels.data.set([...rgb,255],i*4);
  }
  c.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/2.4,1/2.4);texture.anisotropy=4;if(kind==='color')texture.colorSpace=THREE.SRGBColorSpace;resources.push(texture);return texture;
 };
 return {map:make('color'),roughnessMap:make('roughness'),normalMap:make('normal'),normalScale:new THREE.Vector2(.14,.14)};
}
