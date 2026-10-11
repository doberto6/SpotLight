const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {loadData}=await import('../data.mjs'),{buildReplay,buildDemo,timelineTime,stamp}=await import('../src/replay-engine.mjs'),data=loadData();
 const mission=data.missions.find(m=>m.mission_id==='M006'),actions=data.actions.filter(a=>a.mission_id===mission.mission_id),anomalies=data.anomalies.filter(a=>a.mission_id===mission.mission_id);
 const replay=buildDemo(buildReplay(mission,actions,data.events.filter(e=>e.mission_id===mission.mission_id)),anomalies);
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000');await page.getByRole('button',{name:'Mission Replay',exact:true}).click();await page.locator('.mission-label select').selectOption(mission.mission_id);
  await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  const viewport=page.locator('.spot-replay-canvas'),diagnostics=()=>viewport.evaluate(el=>el.__spotDiagnostics),fixed=d=>d.route.map(({visible,...v})=>v);
  const seek=async t=>{await page.locator('.spot-timeline').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},t);await page.waitForTimeout(750);};
  const toggle=page.getByRole('button',{name:'View options'});await toggle.click();await page.getByLabel('Inspection targets',{exact:true}).check();await page.locator('#spot-camera').selectOption('top');await page.getByLabel('Simulation floor').selectOption('1');await toggle.click();await page.waitForTimeout(1000);
  const before=await diagnostics(),guide=fixed(before),target=before.inspection.find(t=>t.key==='PANEL-203@WP05');assert.equal(target.status,'pending');assert.equal(target.visible,true);
  await viewport.scrollIntoViewIfNeeded();const rect=await viewport.boundingBox();assert.ok(target.screen[0]>0&&target.screen[0]<rect.width&&target.screen[1]>0&&target.screen[1]<rect.height);await page.mouse.click(rect.x+target.screen[0],rect.y+target.screen[1]);
  const panel=page.locator('.spot-inspection-panel');await panel.getByRole('heading',{name:'PANEL-203',exact:true}).waitFor();assert.ok((await panel.textContent()).includes('No readings available at this replay time.'));assert.equal(await panel.getByRole('button',{name:'Jump to recorded inspection'}).count(),0);
  const sourceReading=data.readings.find(r=>r.mission_id==='M006'&&r.asset_id==='PANEL-203');await seek(timelineTime(replay,(stamp(sourceReading.timestamp)-replay.start)/1000)+.2);
  const finding=anomalies.find(a=>a.asset_id===target.asset&&a.location_id===target.location);if(finding){await seek(timelineTime(replay,(stamp(finding.timestamp)-replay.start)/1000)+.2);assert.equal((await diagnostics()).inspection.find(t=>t.key===target.key).status,'finding');}else assert.notEqual((await diagnostics()).inspection.find(t=>t.key===target.key).status,'pending');assert.ok((await panel.textContent()).includes(sourceReading.value+' '+sourceReading.unit));await page.locator('.spot-replay-workspace').screenshot({path:'docs/screenshots/fitout-inspection-target.png'});
  await panel.getByRole('button',{name:'Jump to recorded inspection'}).click();await page.waitForTimeout(750);assert.deepEqual(fixed(await diagnostics()),guide);
  const recordedFinding=anomalies.find(a=>a.asset_id==='HX-208');await page.locator('.spot-waypoint-list button').filter({hasText:recordedFinding.location_id}).click();await panel.getByRole('button',{name:recordedFinding.asset_id,exact:true}).click();await seek(timelineTime(replay,(stamp(recordedFinding.timestamp)-replay.start)/1000)+.2);assert.equal((await diagnostics()).inspection.find(t=>t.key===recordedFinding.asset_id+'@'+recordedFinding.location_id).status,'finding');assert.ok(await panel.locator('.record-row').count());
  await page.locator('.spot-waypoint-list button').filter({hasText:'WP05'}).click();await panel.getByRole('button',{name:'PANEL-203',exact:true}).click();
  await seek(0);assert.equal((await diagnostics()).inspection.find(t=>t.key===target.key).status,'pending');assert.equal(await panel.locator('.spot-sensor').count(),0);assert.deepEqual(fixed(await diagnostics()),guide);
  await toggle.click();await page.getByLabel('Inspection targets',{exact:true}).uncheck();await page.waitForTimeout(600);assert.ok((await diagnostics()).inspection.filter(t=>t.key!==target.key).every(t=>!t.visible));await toggle.click();
  await page.locator('.spot-waypoint-list button').filter({hasText:'WP03'}).click();assert.equal(await panel.getByRole('heading',{name:'PANEL-203',exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
  const result={worldTargetClick:true,sourceReadings:true,futureEvidenceHidden:true,stableRoute:true,mobileOverflow:false,fitout:before.fitout,targets:before.inspection.length,errors};fs.writeFileSync('docs/browser-inspection-assets-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
