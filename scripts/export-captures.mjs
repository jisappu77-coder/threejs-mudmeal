import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {chromium} from 'playwright';

const audit=JSON.parse(await readFile('artifacts/scenes/audit.json','utf8'));
assert.equal(audit.reports.length,16);
assert.deepEqual(audit.errors,[]);
audit.checkedAt=(await stat('artifacts/scenes/audit.json')).mtime.toISOString();
audit.bundle=(await readFile('dist/index.html','utf8')).match(/assets\/main-[^" ]+\.js/)?.[0];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 for(const report of audit.reports){
  const png=await readFile(report.path);
  const encoded=await page.evaluate(async source=>{
   const image=new Image();image.src='data:image/png;base64,'+source;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/webp',.9).split(',')[1];
  },png.toString('base64'));
  await writeFile(`public/scenes/${report.scene}/${report.view.replace('.png','')}-render.webp`,Buffer.from(encoded,'base64'));
 }
 await writeFile('public/phase1-comparison/audit.json',JSON.stringify(audit,null,2));
 console.log('Exported 16 actual browser captures to the reference gallery.');
}finally{await browser.close()}
