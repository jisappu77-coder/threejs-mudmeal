// Metres, seconds and radians. Road-guided scooter dynamics, shared by touch and keyboard.
export function createDriving(){
 const state={speed:0,throttle:0,steering:0,lateralSpeed:0,offset:0,lean:0,acceleration:0};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),damp=(a,b,k,dt)=>b+(a-b)*Math.exp(-k*dt);
 function reset(offset=0){Object.assign(state,{speed:0,throttle:0,steering:0,lateralSpeed:0,offset,lean:0,acceleration:0})}
 function step(dt,{throttle=0,brake=0,steering=0,grade=0,curvature=0,wet=false,speedLimit=14,obstacleDistance=Infinity}={}){
  if(!Number.isFinite(dt)||dt<=0)return 0;
  // Small substeps keep stopping distances and steering stable at low frame rates.
  const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
  let distance=0;
  for(let i=0;i<count;i++){
   state.throttle=damp(state.throttle,clamp(throttle,0,1),5,h);
   state.steering=damp(state.steering,clamp(steering,-1,1),7,h);
   const grip=wet?2.1:3.7,curveLimit=Math.sqrt(grip/Math.max(Math.abs(curvature),.0001));
   const safeLimit=Math.min(14,speedLimit,curveLimit);
   const brakeForce=wet?4.1:6.2;
   const stoppingDistance=state.speed*.65+state.speed**2/(2*brakeForce)+1.2;
   const trafficBrake=Number.isFinite(obstacleDistance)?clamp((stoppingDistance-obstacleDistance)/Math.max(1,stoppingDistance*.65),0,1):0;
   const pedalBrake=Math.max(clamp(brake,0,1),trafficBrake);
   const power=state.throttle*3.2*clamp(1-(state.speed/14)**3,0,1)*(1-pedalBrake);
   const drag=.16+.008*state.speed**2;
   const governor=Math.max(0,state.speed-safeLimit)*2.4;
   state.acceleration=power-drag-9.81*grade-pedalBrake*brakeForce-governor;
   const previous=state.speed;
   state.speed=clamp(state.speed+state.acceleration*h,0,14);
   if(state.speed<.03&&!throttle)state.speed=0;
   distance+=(previous+state.speed)*.5*h;
   const oldLateral=state.lateralSpeed;
   const targetLateral=state.steering*state.speed*.22;
   state.lateralSpeed=state.speed===0?0:damp(state.lateralSpeed,targetLateral,wet?2.8:4.5,h);
   state.offset+=state.lateralSpeed*h;
   if(Math.abs(state.offset)>3.15){state.offset=clamp(state.offset,-3.15,3.15);state.lateralSpeed=0;}
   const lateralAcceleration=(state.lateralSpeed-oldLateral)/h+curvature*state.speed**2;
   state.lean=damp(state.lean,clamp(-Math.atan(lateralAcceleration/9.81),-.38,.38),6,h);
  }
  return distance;
 }
 return {state,step,reset};
}
