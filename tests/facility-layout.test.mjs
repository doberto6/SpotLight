import test from 'node:test';
import assert from 'node:assert/strict';
import {loadData} from '../data.mjs';
import {rooms,waypointPositions,worldPoint,worldToImage,floorAt,waypointFloor,markerColor,equipment} from '../src/facility-layout.mjs';
import {SIMULATION_WALK_SPEED,routeBetween,clearSegment,blocked,pathMetrics,dottedPath,pointOnPath,buildReplay,buildSimulation,sourceTime,timelineTime,recoveryRoute,sampleReplay} from '../src/replay-engine.mjs';

test('all reference pins share reversible image registration, floor and room assignment',()=>{
 const data=loadData();assert.equal(rooms.length,15);assert.equal(Object.keys(waypointPositions).length,15);
 for(const loc of data.locations){const p=worldPoint(loc.location_id),r=rooms.find(r=>r.id===loc.location_id),[x,y]=worldToImage(p);assert.equal(floorAt(p.x,p.z),loc.floor);assert.equal(r.floor,loc.floor);assert.ok(Math.abs(x-waypointPositions[loc.location_id][0])<1e-8);assert.ok(Math.abs(y-waypointPositions[loc.location_id][1])<1e-8);assert.ok(x>=r.rect[0]&&x<=r.rect[2]&&y>=r.rect[1]&&y<=r.rect[3]);assert.equal(blocked(p.x,p.z),false);}
 assert.equal(markerColor('WP05','PROCESS'),'#e64545');assert.equal(markerColor('WP02','ELECTRICAL'),'#efb52f');
 for(const o of equipment){const r=rooms.find(r=>r.id===o.waypoint),a=worldPoint(r.id);assert.ok(!blocked(a.x,a.z,[o]));const [x,y]=worldToImage(o);assert.ok(x>=r.rect[0]&&x<=r.rect[2]&&y>=r.rect[1]&&y<=r.rect[3]);}
});
test('every same-floor waypoint pair is reachable, including segment interiors and dotted samples',()=>{
 const ids=Object.keys(waypointPositions);
 for(const a of ids)for(const b of ids){const path=routeBetween(worldPoint(a),worldPoint(b));if(waypointFloor(a)!==waypointFloor(b)){assert.equal(path.length,1);continue;}
 assert.ok(path.length>=2,`${a} -> ${b}`);assert.ok(Math.hypot(path.at(-1).x-worldPoint(b).x,path.at(-1).z-worldPoint(b).z)<1e-8);
 for(let i=1;i<path.length;i++)assert.ok(clearSegment(path[i-1],path[i]),`${a} -> ${b} segment ${i}`);
 const metrics=pathMetrics(path),dots=dottedPath(metrics);for(const dot of dots){assert.equal(blocked(dot.x,dot.z),false);const sampled=pointOnPath(metrics,dot.distance);assert.ok(Math.hypot(sampled.x-dot.x,sampled.z-dot.z)<1e-8);}
 for(let i=1;i<dots.length;i++)assert.ok(Math.abs(dots[i].distance-dots[i-1].distance-.55)<1e-8);
 }
});
test('simulation walks at estimated speed, keeps evidence time reversible and exposes unsupported transfers',()=>{
 const data=loadData();for(const mission of data.missions){const replay=buildReplay(mission,data.actions.filter(a=>a.mission_id===mission.mission_id),[]),sim=buildSimulation(replay);
 for(let i=0;i<sim.segments.length;i++){const seg=sim.segments[i],a=sim.nodes[i],b=sim.nodes[i+1];assert.ok(b.at>=a.at);if(seg.length)assert.ok(Math.abs(seg.length/((b.at-a.at)/1000)-SIMULATION_WALK_SPEED)<1e-8);if(seg.transfer){assert.equal(seg.length,0);assert.equal(sampleReplay(sim,(a.at+b.at)/2000).transfer,true);}}
 for(const v of sim.visits){const t=timelineTime(sim,v.sourceAt/1000);assert.ok(Math.abs(t-v.at/1000)<1e-6);assert.ok(Math.abs(sourceTime(sim,t)-v.sourceAt/1000)<1e-6);}
 }
});
test('manual resume starts at actual position and rejoins an unfinished recorded waypoint',()=>{
 const mission={start_time:'2026-09-01T00:00:00',end_time:'2026-09-01T00:10:00'},actions=[{action_id:'a',location_id:'WP03',timestamp:'2026-09-01T00:01:00'},{action_id:'b',location_id:'WP05',timestamp:'2026-09-01T00:05:00'}],replay=buildReplay(mission,actions,[]),pose={...worldPoint('WP03'),x:worldPoint('WP03').x+.4};const route=recoveryRoute(replay,70,pose);
 assert.equal(route.unreachable,false);assert.deepEqual(route.path[0],pose);assert.equal(route.visit.location_id,'WP05');assert.equal(route.time,300);for(let i=1;i<route.path.length;i++)assert.ok(clearSegment(route.path[i-1],route.path[i]));
});

test('resume during an unfinished inspection returns to it without skipping recorded work',()=>{
 const replay=buildReplay({start_time:'2026-09-01T00:00:00',end_time:'2026-09-01T00:10:00'},[{location_id:'WP03',timestamp:'2026-09-01T00:01:00',duration_sec:30},{location_id:'WP05',timestamp:'2026-09-01T00:05:00',duration_sec:30}],[]);
 const pose={...worldPoint('WP03'),x:worldPoint('WP03').x+.4},route=recoveryRoute(replay,70,pose);assert.equal(route.visit.location_id,'WP03');assert.equal(route.time,70);assert.equal(route.unreachable,false);
});
