// A fixed render budget prevents high-refresh displays from doing needless GPU work.
export function createFrameGate(fps=30){
 let previous=null,next=0;
 return {setFPS(value){if(value!==30&&value!==60)throw Error('Frame rate must be 30 or 60');fps=value;previous=null;},reset(){previous=null;},step(now,hidden=false){if(hidden){previous=null;return null;}const interval=1000/fps;if(previous===null){previous=now;next=now+interval;return 0;}if(now+.5<next)return null;const elapsed=now-previous;previous=now;next+=interval*Math.max(1,Math.floor((now+.5-next)/interval)+1);return Math.min(elapsed/1000,.1);},get fps(){return fps;}};
}

export function startFrameLoop(renderer,update,render,{paused=()=>false,onSuspend=()=>{}}={}){
 const gate=createFrameGate(),gl=renderer.getContext();let fence=null,dirty=true,pending=0;
 function invalidate(){dirty=true;gate.reset();}
 function suspend(){gate.reset();pending=0;onSuspend();if(fence){gl.deleteSync(fence);fence=null;}}
 const refreshPaused=()=>{if(paused())invalidate();};
 document.addEventListener('change',refreshPaused);document.addEventListener('input',refreshPaused);document.addEventListener('click',refreshPaused);
 document.addEventListener('visibilitychange',suspend);window.addEventListener('blur',suspend);window.addEventListener('focus',invalidate);
 renderer.setAnimationLoop(now=>{
  const dt=gate.step(now,document.hidden);if(dt===null||paused()&&!dirty)return;
  pending=Math.min(.1,pending+dt);
  if(fence){if(gl.clientWaitSync(fence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(fence);fence=null;}
  if(pending&&!paused())update(pending);pending=0;render();dirty=false;fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
 });
 return {gate,invalidate,setFPS(fps){gate.setFPS(fps);dirty=true;},dispose(){renderer.setAnimationLoop(null);suspend();document.removeEventListener('change',refreshPaused);document.removeEventListener('input',refreshPaused);document.removeEventListener('click',refreshPaused);document.removeEventListener('visibilitychange',suspend);window.removeEventListener('blur',suspend);window.removeEventListener('focus',invalidate);}};
}
