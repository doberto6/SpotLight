const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {loadData}=await import('../data.mjs'),{buildReplay,buildDemo,timelineTime,stamp}=await import('../src/replay-engine.mjs'),data=loadData();
 const mission=data.missions.find(m=>m.mission_id==='M006'),actions=data.actions.filter(a=>a.mission_id===mission.mission_id),anomalies=data.anomalies.filter(a=>a.mission_id===mission.mission_id);
 const replay=buildDemo(buildReplay(mission,actions,data.events.filter(e=>e.mission_id===mission.mission_id)),anomalies),arrival=replay.visits.find(v=>v.location_id==='WP01'),finding=anomalies.find(a=>a.location_id==='WP01');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000');await page.getByRole('button',{name:'Mission Replay',exact:true}).click();await page.locator('.mission-label select').selectOption('M006');
  await page.waitForFunction(()=>!document.querySelector('.industrial-loading')&&document.querySelector('.spot-replay-canvas')?.__spotDiagnostics?.waypoints,null,{timeout:60000});
  const viewport=page.locator('.spot-replay-canvas'),card=page.locator('.spot-waypoint-details'),diagnostics=()=>viewport.evaluate(el=>el.__spotDiagnostics),fixed=d=>d.route.map(({visible,...v})=>v);
  const seek=async time=>{await page.locator('.spot-timeline').evaluate((el,t)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(t));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},time);await page.waitForTimeout(800);};
  await page.locator('#spot-camera').selectOption('top');await page.getByLabel('Simulation floor').selectOption('1');await seek(arrival.at/1000+.25);
  const initial=await diagnostics(),guide=fixed(initial);
  const clickWP=async id=>{
   await viewport.scrollIntoViewIfNeeded();await page.waitForTimeout(700);const d=await diagnostics(),wp=d.waypoints.find(w=>w.id===id),rect=await viewport.boundingBox();
   assert.ok(wp.visible);assert.ok(wp.screen[0]>0&&wp.screen[0]<rect.width&&wp.screen[1]>0&&wp.screen[1]<rect.height);
   await page.mouse.move(rect.x+wp.screen[0],rect.y+wp.screen[1]);assert.equal(await viewport.locator('canvas').evaluate(el=>el.style.cursor),'pointer');await page.mouse.click(rect.x+wp.screen[0],rect.y+wp.screen[1]);
   await card.getByRole('heading',{name:new RegExp('^'+id+' ·')}).waitFor();await page.waitForTimeout(700);
  };
  await clickWP('WP01');const selected=await diagnostics();assert.equal(selected.timeline.time,initial.timeline.time);assert.deepEqual(selected.pose,initial.pose);assert.equal(selected.collision.id,initial.collision.id);assert.deepEqual(fixed(selected),guide);
  assert.ok((await card.textContent()).includes('pedestrian access'));assert.ok((await card.textContent()).includes('No concerns encountered at this replay time.'));assert.equal(await card.locator('.spot-waypoint-upcoming[open]').count(),0);
  await page.keyboard.press('Escape');assert.equal(await card.count(),0);
  await page.getByRole('button',{name:'Take Control',exact:true}).click();await page.waitForTimeout(700);const manual=await diagnostics();await clickWP('WP01');assert.equal(await page.getByRole('button',{name:'Take Control',exact:true}).isDisabled(),true);assert.equal((await diagnostics()).timeline.time,manual.timeline.time);assert.deepEqual((await diagnostics()).pose,manual.pose);await card.getByRole('button',{name:'Close waypoint details'}).click();
  await page.getByRole('button',{name:'Return to Replay',exact:true}).click();await page.getByLabel('Operating mode').selectOption('demo');await seek(arrival.at/1000+.25);await page.getByRole('button',{name:'Fullscreen',exact:true}).click();await page.waitForTimeout(1000);await clickWP('WP01');assert.equal(await card.evaluate(el=>document.fullscreenElement?.contains(el)),true);
  await card.getByText('Later in this recording · 1 finding',{exact:true}).click();await card.getByRole('button',{name:'Jump to recorded finding'}).click();await page.waitForTimeout(800);
  assert.ok((await card.locator('.spot-waypoint-concerns').first().textContent()).includes(finding.description));assert.ok((await card.textContent()).includes(finding.asset_id));
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await seek(0);assert.ok((await card.textContent()).includes('No concerns encountered at this replay time.'));assert.deepEqual(fixed(await diagnostics()),guide);
  await card.getByRole('button',{name:'Close waypoint details'}).click();await page.locator('.spot-waypoint-list button').filter({hasText:'WP09'}).click();await seek(replay.duration);
  const critical=anomalies.find(a=>a.severity==='CRITICAL'),encountered=card.locator(':scope > .spot-waypoint-concerns');assert.equal(await encountered.count(),1);assert.ok((await encountered.textContent()).includes(critical.description));assert.ok((await encountered.textContent()).includes('CRITICAL'));await card.evaluate(el=>el.scrollTop=0);await page.locator('.spot-viewport').screenshot({path:'docs/screenshots/waypoint-details-desktop.png'});
  await seek(0);assert.equal(await card.locator(':scope > .spot-waypoint-concerns').count(),0);
  await page.getByLabel('Simulation floor').selectOption('2');assert.equal(await card.count(),0);await page.locator('.spot-waypoint-list button').filter({hasText:'WP15'}).click();assert.ok((await card.textContent()).includes('No anomalies recorded here in this mission.'));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await page.locator('.spot-viewport').scrollIntoViewIfNeeded();const stage=await page.locator('.spot-viewport').boundingBox(),popup=await card.boundingBox();assert.ok(popup.x>=stage.x&&popup.x+popup.width<=stage.x+stage.width+1);assert.ok(popup.y>=stage.y&&popup.y+popup.height<=stage.y+stage.height+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.locator('.spot-viewport').screenshot({path:'docs/screenshots/waypoint-details-mobile.png'});
  await card.getByRole('button',{name:'Close waypoint details'}).click();assert.equal(await page.locator('.spot-minimap').isVisible(),true);assert.deepEqual(errors,[]);
  const result={wpLabelMouseClick:true,hoverPointer:true,clickPreservesTimePoseHitboxAndRoute:true,manualClickPreservesBranch:true,fullscreenCard:true,upcomingEvidenceSeparate:true,criticalRecordedFinding:true,rewindHidesEncounteredEvidence:true,floorFiltering:true,sidebarSelection:true,mobileCardFitsViewport:true,closeAndEscape:true,errors};fs.writeFileSync('docs/browser-waypoint-details-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
