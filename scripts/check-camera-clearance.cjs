// Focused regression for low free-camera positions under the full roof.
const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {obstacles,floorAt}=await import('../src/facility-layout.mjs');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000');await page.getByRole('button',{name:'Mission Replay',exact:true}).click();await page.locator('.mission-label select').selectOption('M006');
  await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  const viewport=page.locator('.spot-replay-canvas'),fixed=d=>d.route.map(({visible,...v})=>v),get=()=>viewport.evaluate(el=>el.__spotDiagnostics);
  await page.waitForFunction(()=>document.querySelector('.spot-replay-canvas')?.__spotDiagnostics);const guide=fixed(await get());
  const clear=async()=>{await page.waitForTimeout(700);const d=await get(),[x,y,z]=d.camera.position;
   assert.ok(y>=.25);assert.ok(d.camera.position.every(Number.isFinite));assert.deepEqual(fixed(d),guide);
   const floor=floorAt(d.camera.target[0],d.camera.target[2]);
   assert.equal(obstacles.some(o=>o.floor===floor&&Math.abs(x-o.x)<o.w/2-.03&&Math.abs(z-o.z)<o.d/2-.03&&y>0&&y<(o.type==='wall'?(o.exterior?6.4:3.5):o.h)),false,'camera must stay outside wall and equipment interiors');
   return {floor,position:d.camera.position,target:d.camera.target};
  };
  const views=[];
  for(const [floor,time] of [['1',25],['2',69]]){
   await page.locator('#spot-camera').selectOption('chase');await page.getByLabel('Simulation floor').selectOption(floor);
   await page.locator('.spot-timeline').evaluate((el,time)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(time));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},time);
   await page.getByLabel('Roof visibility').selectOption('full');await page.locator('#spot-camera').selectOption('free');views.push(await clear());
   const rect=await viewport.boundingBox();await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.58,{steps:12});await page.mouse.up();views.push(await clear());
   for(const mode of ['top','first','chase','free']){await page.locator('#spot-camera').selectOption(mode);await page.waitForTimeout(650);assert.deepEqual(fixed(await get()),guide);}
  }
  assert.deepEqual(errors,[]);const results={fullRoofFreeCameraClear:true,orbitCameraClear:true,bothFloors:true,staticGuideUnchanged:true,views,errors};fs.writeFileSync('docs/browser-camera-clearance-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
