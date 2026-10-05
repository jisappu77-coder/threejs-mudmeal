import assert from 'node:assert/strict';
import {createFrameGate,startFrameLoop} from '../src/frame-loop.js';
for(const refresh of [60,90,120,144]){
 const gate=createFrameGate();let frames=0,elapsed=0;
 for(let i=0;i<=refresh*10;i++){const dt=gate.step(i*1000/refresh);if(dt!==null){frames++;elapsed+=dt;}}
 assert.ok(frames>=298&&frames<=302,`30 FPS budget on ${refresh} Hz display: ${frames}`);
 assert.ok(Math.abs(elapsed-10)<.15,'Simulation time must follow real time without speeding up or slowing down');
 const hidden=gate.step(12000,true);assert.equal(hidden,null);assert.equal(gate.step(20000),0,'Resume must not advance gameplay by hidden time');
 gate.setFPS(60);let smooth=0;for(let i=0;i<=refresh*2;i++)if(gate.step(21000+i*1000/refresh)!==null)smooth++;assert.ok(smooth>=118&&smooth<=122);
}
assert.throws(()=>createFrameGate().setFPS(120));
console.log('30/60 FPS budgets, high-refresh pacing, simulation timing and hidden-tab resume passed');

// Exercise suspension and GPU backpressure, not just the pacing arithmetic.
const previousDocument=globalThis.document,previousWindow=globalThis.window;
globalThis.document=new EventTarget();document.hidden=false;globalThis.window=new EventTarget();
try{
 let callback,paused=false,renders=0,updates=[],busy=false,deleted=0;
 const gl={TIMEOUT_EXPIRED:1,SYNC_GPU_COMMANDS_COMPLETE:2,clientWaitSync:()=>busy?1:0,deleteSync:()=>deleted++,fenceSync:()=>({}),flush(){}};
 const renderer={getContext:()=>gl,setAnimationLoop:fn=>callback=fn};
 const loop=startFrameLoop(renderer,dt=>updates.push(dt),()=>renders++,{paused:()=>paused});
 callback(0);busy=true;callback(34);assert.equal(renders,1);assert.equal(updates.length,0);
 busy=false;callback(68);assert.equal(renders,2);assert.ok(Math.abs(updates[0]-.068)<1e-9,'GPU waits must preserve simulation time');
 paused=true;loop.invalidate();callback(102);const pausedRenders=renders,pausedUpdates=updates.length;
 for(const time of [136,170,204])callback(time);assert.equal(renders,pausedRenders);assert.equal(updates.length,pausedUpdates);
 document.dispatchEvent(new Event('change'));callback(238);callback(272);assert.equal(renders,pausedRenders+1,'Paused settings redraw once');
 document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));callback(5000);assert.equal(renders,pausedRenders+1);
 paused=false;document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));callback(6000);assert.equal(updates.length,pausedUpdates,'Hidden time must not enter the simulation');
 loop.setFPS(60);callback(6100);callback(6117);assert.ok(Math.abs(updates.at(-1)-.017)<1e-9);
 loop.dispose();assert.equal(callback,null);assert.ok(deleted>0);
}finally{globalThis.document=previousDocument;globalThis.window=previousWindow;}
console.log('Paused redraws, hidden-tab suspension, GPU backpressure and loop cleanup passed');
