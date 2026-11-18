const { chromium } = require('playwright'); const fs=require('fs');
const fx=fs.readFileSync(__dirname+'/ui_fixture.json','utf8');
const html=fs.readFileSync('/mnt/project-files/handover_review/gas/Index.html','utf8');
const mock=`<script>const FX=${fx};window.__calls=[];
function mk(ok,ng){return new Proxy({},{get(_,name){ if(name==='withSuccessHandler') return f=>mk(f,ng); if(name==='withFailureHandler') return f=>mk(ok,f);
 return (...a)=>{window.__calls.push([name,a]); setTimeout(()=>{ 
  if(name==='apiBootstrap') ok(FX.b); else if(name==='apiLoadJob') ok(FX.l);
  else if(name==='apiGenerateEmergPreview') ok(undefined);
  else if(name==='apiGetEmergPreviewResult') ok({ok:true,fileId:'1',fileName:'Emerg_D507 test.pdf',uploadMode:'NEW_FILE',boxUrl:'https://app.box.com/file/1',warnings:[]});
  else if(name==='apiGenerateWorkerLedgerPreview') ok({ok:true,fileId:'2',fileName:'Worker_D507 test.xlsx',uploadMode:'NEW_VERSION',boxUrl:'https://app.box.com/file/2',warnings:['sample warning']});
 },30);} }});}
window.google={script:{run:mk(()=>{},e=>{throw e})}};</script>`;
(async()=>{
 const br=await chromium.launch(); 
 for (const [name,vp] of [['desk',{width:1280,height:900}],['phone',{width:390,height:800}]]) {
  const pg=await br.newPage({viewport:vp,deviceScaleFactor:name==='desk'?2:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  await pg.setContent(html.replace('<head>','<head>'+mock)); await pg.waitForTimeout(200);
  await pg.screenshot({path:`${__dirname}/ui_${name}_0.png`});
  await pg.fill('#jobFilter','d507'); const n=await pg.locator('#jobSelect option').count();
  await pg.selectOption('#jobSelect',{index:1}); await pg.waitForTimeout(200);
  await pg.screenshot({path:`${__dirname}/ui_${name}_1.png`,fullPage:true});
  const pills0=await pg.locator('.pill').allTextContents();
  await pg.selectOption('#leaderSelect',{index:1}); await pg.fill('#leaderPHS','1234');
  await pg.locator('#modeSeg label').nth(1).click();
  await pg.selectOption('#worker0',{index:3}); await pg.selectOption('#worker1',{index:4});
  await pg.locator('.ky-check').nth(2).check();
  await pg.waitForTimeout(100);
  const pills1=await pg.locator('.pill').allTextContents();
  await pg.click('#allBtn'); await pg.waitForTimeout(500);
  const pills2=await pg.locator('.pill').allTextContents();
  const msgs=await pg.locator('.doc-msg').allTextContents();
  await pg.screenshot({path:`${__dirname}/ui_${name}_2.png`,fullPage:true});
  const calls=await pg.evaluate(()=>window.__calls.map(c=>c[0]));
  const input=await pg.evaluate(()=>window.__calls.find(c=>c[0]==='apiGenerateWorkerLedgerPreview')[1][0]);
  const overflow=await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  console.log(name,{n,pills0,pills1,pills2,msgs,calls,errs,overflow}); if(name==='desk') console.log(JSON.stringify(input));
  // jump test
  await pg.fill('#leaderPHS',''); await pg.waitForTimeout(50); await pg.locator('#doc-emerg .missing button').first().click();
  console.log('focus', await pg.evaluate(()=>document.activeElement.id), await pg.locator('.pill').first().textContent());
  await pg.close();
 }
 await br.close();
})();
