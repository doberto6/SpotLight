import test from 'node:test';
import assert from 'node:assert/strict';
import {mapReferences,linkedMapText,mapDestination} from '../src/chat-map-links.mjs';

const locations=[{location_id:'WP09',location_name:'Turbine Hall',floor:'2'}];
const record={location_id:'WP09',asset_id:'PANEL-211',action_id:'A0060',mission_id:'M006',timestamp:'2026-09-05T12:00:00'};
test('answer map links are grounded in evidence and respect ID boundaries',()=>{
  const refs=mapReferences([{record}],locations);
  const parts=linkedMapText('WP09, PANEL-211 and Turbine Hall; WP090 and WP01.',refs);
  assert.deepEqual(parts.filter(p=>p.location_id).map(p=>p.text),['WP09','PANEL-211','Turbine Hall']);
  assert.equal(mapReferences([{record:{location_id:'WP99'}}],locations).size,0);
});
test('map navigation uses the cited mission and date, while aggregate links use latest visit',()=>{
  const data={locations,missions:[{mission_id:'M006',start_time:'2026-09-05T10:00:00'}],actions:[record,{...record,action_id:'A0070',timestamp:'2026-09-07T12:00:00'}]};
  assert.deepEqual(mapDestination(data,'WP09',record),{location:locations[0],mission:'M006',day:'2026-09-05'});
  assert.equal(mapDestination(data,'WP09').day,'2026-09-07');
  assert.equal(mapDestination(data,'WP99',record),null);
});
