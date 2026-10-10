// The kit provides example imagery, not photographs associated with action IDs.
const folder='/kit-assets/sample_inspection_images/';
export function inspectionMedia(action){
 if(!action)return null;
 const examples={THERMAL_INSPECTION:['thermal_pump_bearing_01.jpg','Thermal bearing inspection'],VISUAL_INSPECTION:['visual_pump_motor_01.jpg','Pump and motor inspection'],GAUGE_READING:['gauge_pressure_01.jpg','Pressure gauge inspection'],ACOUSTIC_INSPECTION:['acoustic_valve_01.jpg','Acoustic valve inspection']};
 const example=action.location_id==='WP05'&&action.action_type==='VISUAL_INSPECTION'?['pipe_gallery_01.jpg','Pipe gallery inspection']:action.location_id==='WP10'&&action.action_type==='VISUAL_INSPECTION'?['valve_detail_01.jpg','Valve inspection']:examples[action.action_type];
 return example?{url:folder+example[0],title:example[1],provenance:'Synthetic sample · challenge kit'}:null;
}
