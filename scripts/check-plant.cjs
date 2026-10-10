// Requires Playwright and Chrome. SPOT_PLAYWRIGHT_MODULE can point to an existing
// Playwright installation; this is a dev check, not a runtime dependency.
const {chromium}=require(process.env.SPOT_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.SPOT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[],warnings=[],assets=new Set();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'||/component unavailable/i.test(m.text()))warnings.push(m.text()+' '+m.location().url);});
    page.on('response',r=>{if(/\/models\/(industrial|engineered|structural|services)\/.+\.glb$/.test(r.url())){assert.equal(r.status(),200);assets.add(r.url().split('/').at(-1));}});
    await page.goto(process.env.SPOT_URL||'http://localhost:3000');
    await page.getByRole('button',{name:'Mission Replay',exact:true}).click();
    const viewport=page.locator('.spot-replay-canvas');await viewport.locator('canvas').waitFor();
    await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
    assert.equal(assets.size,15);
    const captureDir=process.env.SPOT_CAPTURE_DIR||'/tmp/spotlight-upgrade';fs.mkdirSync(captureDir,{recursive:true});
    await viewport.screenshot({path:path.join(captureDir,'chase.png')});
    for(const mode of ['free','top','first','chase']){await page.locator('#spot-camera').selectOption(mode);await page.waitForTimeout(200);}
    const before=await page.locator('.spot-telemetry dd').nth(2).innerText();
    await page.getByRole('button',{name:'Take Control',exact:true}).click();await viewport.focus();
    await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');
    await page.getByRole('button',{name:'Stop',exact:true}).click();await page.waitForTimeout(250);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const moved=await page.locator('.spot-telemetry dd').nth(2).innerText();assert.notEqual(before,moved);
    await page.waitForTimeout(300);assert.equal(await page.locator('.spot-telemetry dd').nth(2).innerText(),moved);
    await page.getByRole('button',{name:'Return to Replay',exact:true}).click();
    await page.waitForFunction(expected=>document.querySelectorAll('.spot-telemetry dd')[2]?.textContent===expected,before,{timeout:15000});
    assert.equal(await page.locator('.spot-telemetry dd').nth(2).innerText(),before);
    await page.locator('.spot-findings button').first().click();
    assert.equal(await page.locator('.spot-findings button[aria-pressed="true"]').count(),1);
    assert.ok(await page.locator('.spot-sensor').count()>0);
    await page.locator('.spot-timeline').evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'420');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    assert.equal(await page.locator('.spot-timeline').inputValue(),'420');
    await page.locator('#spot-camera').selectOption('top');await viewport.hover();await page.mouse.wheel(0,1000);await page.waitForTimeout(300);
    await viewport.screenshot({path:path.join(captureDir,'plant.png')});
    await page.locator('#spot-camera').selectOption('chase');
    await page.getByRole('button',{name:'Take Control',exact:true}).click();
    await page.getByRole('button',{name:'Resume Mission',exact:true}).click();
    await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
    // Scene teardown/recreation must keep asset materials and controls intact.
    await page.locator('.mission-label select').selectOption('M001');
    await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
    await page.locator('.mission-label select').selectOption('M006');
    await page.waitForFunction(()=>!document.querySelector('.industrial-loading'),null,{timeout:60000});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
    console.log(JSON.stringify({loadedModels:[...assets],manualMovement:true,stop:true,returnToReplay:true,cameraModes:4,anomalyReadings:true,resume:true,missionSwitch:true,mobileOverflow:false,errors,warnings,captureDir}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
