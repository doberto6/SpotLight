import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectionMedia} from '../src/inspection-media.mjs';
import {configurationFilter,riskSQL} from '../intelligence-queries.mjs';
test('provided photos resolve to local kit assets and carry sample provenance',()=>{
 for(const action of [{action_type:'THERMAL_INSPECTION'},{action_type:'GAUGE_READING'},{action_type:'ACOUSTIC_INSPECTION'},{action_type:'VISUAL_INSPECTION'},{action_type:'VISUAL_INSPECTION',location_id:'WP05'},{action_type:'VISUAL_INSPECTION',location_id:'WP10'}]){const media=inspectionMedia(action);assert.ok(fs.existsSync(path.join('data/SPOT_KnightHacks_Challenge_Kit Part One/04_ASSETS',media.url.replace('/kit-assets/',''))));assert.match(media.provenance,/Synthetic sample/);}
 assert.equal(inspectionMedia({action_type:'NAVIGATION'}),null);
});
test('risk configuration rejects injection and filters the left join without removing unvisited waypoints',()=>{
 assert.throws(()=>configurationFilter("V2' OR 1=1 --"),/Invalid/);
 assert.match(riskSQL('V2'),/LEFT JOIN[\s\S]+ON l.location_id=a.location_id AND a.configuration_version='V2'/);
 assert.equal(configurationFilter('all'),'');
});
