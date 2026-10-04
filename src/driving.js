// Metres, seconds and radians. Free-steering scooter dynamics, shared by touch and keyboard.
export function createDriving(){
 const state={speed:0,throttle:0,steering:0,yawRate:0,heading:0,lean:0,acceleration:0};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),damp=(a,b,k,dt)=>b+(a-b)*Math.exp(-k*dt);
 function reset(heading=0){Object.assign(state,{speed:0,throttle:0,steering:0,yawRate:0,heading,lean:0,acceleration:0})}
 function step(dt,{throttle=0,brake=0,steering=0,grade=0,curvature=0,wet=false,speedLimit=14}={}){
  if(!Number.isFinite(dt)||dt<=0)return 0;
  // Small substeps keep stopping distances and steering stable at low frame rates.
  const count=Math.max(1,Math.ceil(dt/(1/120))),h=dt/count;
  let distance=0;
  for(let i=0;i<count;i++){
   state.throttle=damp(state.throttle,clamp(throttle,0,1),5,h);
   state.steering=damp(state.steering,clamp(steering,-1,1),7,h);
   const turnCurvature=-Math.tan(state.steering*.55)/(1.45+state.speed*.12);
   const grip=wet?2.1:3.7,curveLimit=Math.sqrt(grip/Math.max(Math.abs(curvature),Math.abs(turnCurvature),.0001));
   const safeLimit=Math.min(14,speedLimit,curveLimit);
   const brakeForce=wet?4.1:6.2;
   const pedalBrake=clamp(brake,0,1);
   const power=state.throttle*3.2*clamp(1-(state.speed/14)**3,0,1)*(1-pedalBrake);
   const drag=.16+.008*state.speed**2;
   const governor=Math.max(0,state.speed-safeLimit)*2.4;
   state.acceleration=power-drag-9.81*grade-pedalBrake*brakeForce-governor;
   const previous=state.speed;
   state.speed=clamp(state.speed+state.acceleration*h,0,14);
   if(state.speed<.03&&!throttle)state.speed=0;
   distance+=(previous+state.speed)*.5*h;
   const targetYaw=clamp(turnCurvature*state.speed,-grip/Math.max(.5,state.speed),grip/Math.max(.5,state.speed));
   state.yawRate=state.speed===0?0:damp(state.yawRate,targetYaw,wet?2.8:4.5,h);
   state.heading+=state.yawRate*h;
   state.lean=damp(state.lean,clamp(Math.atan(state.yawRate*state.speed/9.81),-.38,.38),6,h);
  }
  return distance;
 }
 return {state,step,reset};
}
