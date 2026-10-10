import {equipment} from './facility-layout.mjs';
// Supplemental cooling/service assemblies remain wholly inside registered pads.
export const servicePlacements=equipment.filter(o=>['pump_skid','compressor','heat_exchanger','pressure_vessel','turbine_generator'].includes(o.asset)).map(o=>({pad:o,x:o.x,z:o.z+o.d/2-.4,floor:o.floor,size:[Math.min(1.8,o.w-.2),Math.min(1.8,o.h-.3),.6]}));
export const servicePorts=[[-.65,.3,0],[.65,.3,0]];

// A deterministic tap on a bay header, independent of robot or replay state.
export function headerTap(bay,p,v=.15){
 const a=bay.point(0,v),b=bay.point(1,v),dx=b.x-a.x,dz=b.z-a.z;
 const u=Math.max(.04,Math.min(.96,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
 return bay.point(u,v);
}
