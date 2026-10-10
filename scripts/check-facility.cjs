// Browser acceptance checks. Requires the same external Playwright/Chrome setup
// as check-plant.cjs; screenshots use software WebGL, not a hardware FPS claim.
const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SPOT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[],warnings=[],assets=new Set(),dir=process.env.SPOT_CAPTURE_DIR||'/tmp/spotlight-facility';fs.mkdirSync(dir,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/component unavailable/i.test(m.text()))warnings.push(m.text());});page.on('response',r=>{if(/\/models\/(industrial|engineered|structural|services)\/.+\.glb$/.test(r.url())){assert.equal(r.status(),200);assets.add(r.url().split('/').at(-1));}});
  await page.goto(process.env.SPOT_URL||'http://localhost:3000');await page.getByRole('button',{name:'Mapping',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  await page.locator('.facility-3d').screenshot({path:path.join(dir,'reference-registered-both-floors.png')});
  await page.getByLabel('Floor',{exact:true}).selectOption('2');await page.waitForTimeout(500);await page.locator('.facility-3d').screenshot({path:path.join(dir,'floor-2.png')});
  await page.getByRole('button',{name:'Mission Replay',exact:true}).click();
  assert.equal(await page.getByLabel('Simulation floor').inputValue(),'2');assert.equal(await page.locator('.spot-waypoint-list button').count(),5);
  await page.getByLabel('Simulation floor').selectOption('all');assert.equal(await page.locator('.spot-waypoint-list button').count(),15);
  await page.locator('.mission-label select').selectOption('M001');await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  await page.getByLabel('Operating mode').selectOption('simulation');await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  const {loadData}=await import('../data.mjs'),{buildReplay,buildSimulation}=await import('../src/replay-engine.mjs'),data=loadData(),mission=data.missions.find(m=>m.mission_id==='M001'),sim=buildSimulation(buildReplay(mission,data.actions.filter(a=>a.mission_id==='M001'),[]));
  const segment=sim.segments.findIndex(s=>s.length>4&&!s.transfer),start=sim.nodes[segment].at/1000+1;
  const seek=async seconds=>{await page.locator('.spot-timeline').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},seconds);await page.waitForTimeout(500);};
  await seek(start);const viewport=page.locator('.spot-replay-canvas'),position=()=>page.locator('.spot-telemetry dd').nth(2).innerText(),before=await position();
  await page.getByRole('button',{name:'▶ Run Mission',exact:true}).click();await page.waitForTimeout(1500);await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();assert.notEqual(await position(),before);
  await page.getByRole('button',{name:'Take Control',exact:true}).click();await viewport.focus();await page.keyboard.down('a');await page.waitForTimeout(300);await page.keyboard.up('a');await page.keyboard.down('w');await page.waitForTimeout(800);await page.keyboard.up('w');await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForTimeout(400);const manual=await position(),pausedTime=Number(await page.locator('.spot-timeline').inputValue());
  await page.getByRole('button',{name:'Resume Mission',exact:true}).click();await page.waitForTimeout(300);assert.ok(await page.getByText('Rejoining the mission from the current simulated position · source time paused.',{exact:true}).count());assert.equal(Number(await page.locator('.spot-timeline').inputValue()),pausedTime);
  // Resume must move incrementally from manual pose rather than restore the old pose.
  const parse=s=>s.split(' / ').map(Number),a=parse(manual),b=parse(await position());assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<2);
  await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();await page.locator('#spot-camera').selectOption('top');await viewport.hover();await page.mouse.wheel(0,1000);await page.waitForTimeout(500);await viewport.screenshot({path:path.join(dir,'white-dotted-route.png')});
  await page.getByRole('button',{name:'Return to Replay',exact:true}).click();
  await page.getByLabel('Simulation floor').selectOption('1');await page.locator('.spot-waypoint-list button').filter({hasText:'WP03'}).click();assert.ok(await page.getByRole('heading',{name:'WP03 · Cooling Loop',exact:true}).count());
  await page.locator('.mission-label select').selectOption('M006');await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});await page.locator('.spot-findings button').last().click();assert.ok(await page.locator('.spot-sensor').count()>0);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.equal(assets.size,15);assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  console.log(JSON.stringify({models:assets.size,sharedMappingRenderer:true,floorSelectionPersists:true,waypoints:15,simulationWalks:true,resumeFromManualPose:true,sourceTimePausedWhileRejoining:true,recordedEvidence:true,mobileOverflow:false,errors,warnings,screenshots:dir}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
