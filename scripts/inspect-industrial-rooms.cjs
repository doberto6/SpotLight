// Reproducible room-by-room inspection using recorded arrivals, not debug teleports.
const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {loadData}=await import('../data.mjs'),{buildReplay,buildDemo}=await import('../src/replay-engine.mjs'),data=loadData();
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000');await page.getByRole('button',{name:'Mission Replay',exact:true}).click();await page.getByRole('button',{name:'View options'}).click();
  const viewport=page.locator('.spot-replay-canvas'),ready=()=>page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  for(const location of data.locations.filter(l=>!process.env.SPOT_ROOM_FILTER||process.env.SPOT_ROOM_FILTER.split(',').includes(l.location_id))){
   const action=data.actions.find(a=>a.location_id===location.location_id),mission=data.missions.find(m=>m.mission_id===action.mission_id);
   const replay=buildDemo(buildReplay(mission,data.actions.filter(a=>a.mission_id===mission.mission_id),data.events.filter(e=>e.mission_id===mission.mission_id)),data.anomalies.filter(a=>a.mission_id===mission.mission_id));
   const visit=replay.visits.find(v=>v.action_id===action.action_id);
   await page.locator('.mission-label select').selectOption(mission.mission_id);await ready();await page.getByLabel('Simulation floor').selectOption(location.floor);
   // Range controls quantize to 0.1 seconds; inspect inside the dwell interval.
   await page.locator('.spot-timeline').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},visit.at/1000+.25);
   await page.locator('#spot-camera').selectOption('top');await page.getByLabel('Roof visibility').selectOption('overhead');await page.waitForTimeout(1000);
   await viewport.screenshot({path:'docs/screenshots/collision-room-'+location.location_id+'-plan.png'});
   await page.locator('#spot-camera').selectOption('chase');await page.getByLabel('Roof visibility').selectOption('cutaway');await page.waitForTimeout(1100);
   const d=await viewport.evaluate(el=>el.__spotDiagnostics);assert.equal(d.collision.blocked,false);assert.ok(Math.hypot(d.pose.x-visit.x,d.pose.z-visit.z)<.001,location.location_id+' arrival: '+JSON.stringify({actual:d.pose,expected:visit,time:d.timeline}));
   await viewport.screenshot({path:'docs/screenshots/collision-room-'+location.location_id+'.png'});
   results.push({waypoint:location.location_id,floor:location.floor,mission:mission.mission_id,pose:d.pose,hitboxClear:true});
  }
  await page.getByRole('button',{name:'Mapping',exact:true}).click();await ready();await page.getByLabel('Show SPOT Hitbox',{exact:true}).uncheck();await page.waitForTimeout(600);
  assert.equal(await viewport.evaluate(el=>el.__spotDiagnostics.collision.visible),false);await page.getByLabel('Show SPOT Hitbox',{exact:true}).check();await page.waitForTimeout(600);assert.equal(await viewport.evaluate(el=>el.__spotDiagnostics.collision.visible),true);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);fs.writeFileSync(process.env.SPOT_ROOM_RESULTS_FILE||'docs/browser-industrial-rooms-results.json',JSON.stringify({rooms:results,mappingHitboxToggle:true,mappingMobileOverflow:false,errors},null,2));console.log('Inspected and captured '+results.length+' rooms; Mapping controls and mobile layout passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
