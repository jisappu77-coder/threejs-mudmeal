// Requires a built site served on localhost:4173. Totals include all render passes.
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try {for(const [path,key] of [['real-map.html','__REAL_MAP__'],['index.html','__MUD_MEALS__']]) {
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.addInitScript(key=>Object.defineProperty(window,key,{configurable:true,set(app){app.renderer.setAnimationLoop=()=>{};Object.defineProperty(window,key,{value:app,configurable:true})}}),key);
await page.goto('http://localhost:4173/'+path);await page.waitForFunction(key=>window[key]?.ready,key,{timeout:240000});
const r=await page.evaluate(key=>{const a=window[key],renderer=a.renderer;a.update(1/30);renderer.info.autoReset=false;const sample=()=>{renderer.info.reset();const start=performance.now();a.graphics.render();const gl=renderer.getContext();gl.finish();return {ms:performance.now()-start,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.autoUpdate}};sample();return [sample(),sample(),sample()]},key);results.push({path,samples:r});console.log(JSON.stringify(results.at(-1)));await page.close();
}}finally{await browser.close()}
await mkdir('artifacts/performance',{recursive:true});await writeFile('artifacts/performance/'+(process.argv[2]||'after')+'.json',JSON.stringify(results,null,2));
