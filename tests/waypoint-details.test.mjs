import test from 'node:test';
import assert from 'node:assert/strict';
import {loadData} from '../data.mjs';
import {waypointDetails} from '../src/waypoint-details.mjs';
import {stamp} from '../src/replay-engine.mjs';

const data=loadData(),records=id=>({actions:data.actions.filter(a=>a.mission_id===id),readings:data.readings.filter(a=>a.mission_id===id),anomalies:data.anomalies.filter(a=>a.mission_id===id)}),location=id=>data.locations.find(l=>l.location_id===id);
test('waypoint concerns use the selected location and separate later findings from encountered evidence',()=>{
 const source=records('M006'),finding=source.anomalies.find(a=>a.location_id==='WP01'),before=waypointDetails(location('WP01'),source,data.assets,stamp(finding.timestamp)-1);
 assert.ok(before.purpose);assert.ok(before.precaution);assert.ok(before.upcoming.includes(finding));assert.ok(!before.encountered.includes(finding));
 const after=waypointDetails(location('WP01'),source,data.assets,stamp(finding.timestamp));assert.ok(after.encountered.includes(finding));assert.ok(!after.upcoming.includes(finding));
 assert.ok([...after.encountered,...after.upcoming].every(a=>a.location_id==='WP01'&&a.mission_id==='M006'));
 assert.deepEqual(waypointDetails(location('WP01'),source,data.assets,stamp(finding.timestamp)-1),before);
});
test('failed actions require review only after the recorded action completes',()=>{
 const source=records('M001'),failed=source.actions.find(a=>a.status==='FAILED'),loc=location(failed.location_id),start=stamp(failed.timestamp),end=start+Number(failed.duration_sec)*1000;
 const during=waypointDetails(loc,source,data.assets,start);assert.ok(!during.failures.includes(failed));assert.ok(during.status.endsWith('in progress'));
 const after=waypointDetails(loc,source,data.assets,end);assert.ok(after.failures.includes(failed));assert.equal(after.reviewRequired,true);assert.equal(after.status,'Inspection needs review');
});
test('waypoint assets retain catalog IDs and readings only appear at their source time',()=>{
 const source=records('M006');
 for(const loc of data.locations){
  const before=waypointDetails(loc,source,data.assets,0);assert.equal(before.latest,null);assert.equal(before.status,'Not visited at this replay time');assert.deepEqual(before.readings,[]);assert.deepEqual(before.failures,[]);
  for(const a of source.actions.filter(a=>a.location_id===loc.location_id))assert.ok(before.assets.some(asset=>asset.asset_id===a.asset_id));
  const end=waypointDetails(loc,source,data.assets,Infinity);assert.ok(end.readings.every(r=>r.action_id===end.latest?.action_id&&r.location_id===loc.location_id));assert.ok(end.upcoming.length===0);
 }
 const reading=source.readings[0],at=stamp(reading.timestamp),info=waypointDetails(location(reading.location_id),source,data.assets,at);
 assert.ok(info.readings.every(r=>stamp(r.timestamp)<=at));
});
test('a location without mission evidence remains unvisited and has no fabricated concerns',()=>{
 const loc=location('WP01'),info=waypointDetails(loc,{actions:[],readings:[],anomalies:[]},data.assets,Infinity);
 assert.equal(info.status,'Not visited at this replay time');assert.equal(info.reviewRequired,false);assert.deepEqual(info.encountered,[]);assert.deepEqual(info.upcoming,[]);assert.equal(waypointDetails(null,records('M006'),data.assets,0),null);
});
