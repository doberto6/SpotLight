const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:process.env.SPOT_SOFTWARE?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
  const settle=()=>page.waitForTimeout(1500),dir='docs/screenshots',phase=process.env.SPOT_PHASE||'before';fs.mkdirSync(dir,{recursive:true});
  await page.goto('http://localhost:3000');await page.getByRole('button',{name:'Mapping',exact:true}).click();await ready();await settle();
  await page.locator('.facility-3d').screenshot({path:dir+'/'+phase+'-overview.png'});
  await page.getByRole('button',{name:'Mission Replay',exact:true}).click();await page.locator('.mission-label select').selectOption('M006');await ready();await page.getByLabel('Simulation floor').selectOption('1');await settle();
  const viewport=page.locator('.spot-replay-canvas');await viewport.screenshot({path:dir+'/'+phase+'-walls.png'});
  if(process.env.SPOT_DETAIL){
   await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
   const seek=async t=>{await page.locator('.spot-timeline').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},t);await settle();};
   await seek(25);await page.locator('#spot-camera').selectOption('free');await page.getByLabel('Roof visibility').selectOption('full');await settle();
   await viewport.screenshot({path:dir+'/'+phase+'-ceiling.png'});
   await page.getByLabel('Roof visibility').selectOption('cutaway');await page.locator('#spot-camera').selectOption('chase');await settle();
   await viewport.screenshot({path:dir+'/'+phase+'-equipment.png'});
   await page.getByLabel('Simulation floor').selectOption('2');await seek(69);await page.locator('#spot-camera').selectOption('free');await page.getByLabel('Roof visibility').selectOption('full');await settle();
   await viewport.screenshot({path:dir+'/'+phase+'-floor2.png'});
  }
  if(errors.length)throw Error(errors.join(String.fromCharCode(10)));console.log('Captured '+phase);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
