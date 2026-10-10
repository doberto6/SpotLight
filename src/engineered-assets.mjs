import {obstacles} from './replay-engine.mjs';

export const engineeredAssetNames=['pump_skid','turbine_generator','pressure_vessel','oil_transformer','control_cabinets','compressor','heat_exchanger'];
export function equipmentAsset(o) {
  if(o.type==='wall')return null;
  if(o.asset)return engineeredAssetNames.includes(o.asset)?o.asset:null;
  if(o.type==='generator')return 'turbine_generator';
  return o.x< -20?'pressure_vessel':o.x<0?'pump_skid':o.x<10?'control_cabinets':'oil_transformer';
}
// The original collision envelope remains authoritative. Exported equipment is
// fitted inside it, with a little clearance around every side and above it.
export function equipmentPlacements(name) {
  return obstacles.filter(o=>equipmentAsset(o)===name).map(o=>({position:[o.x,.22,o.z],size:[o.w-.12,o.h-.22,o.d-.12]}));
}
