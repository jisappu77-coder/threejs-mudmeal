import assert from 'node:assert/strict';
import {createDriving} from '../src/driving.js';
function run(hz,input,seconds=8){const d=createDriving();let distance=0;for(let i=0;i<hz*seconds;i++)distance+=d.step(1/hz,input);return {d,distance}}
const a=run(30,{throttle:1}),b=run(120,{throttle:1});
assert.ok(a.d.state.speed>10&&a.d.state.speed<=14);
assert.ok(Math.abs(a.distance-b.distance)<.04,'Acceleration must be independent of frame rate');
const downhill=run(60,{throttle:1,grade:-.12}),uphill=run(60,{throttle:1,grade:.12});
assert.ok(downhill.d.state.speed>uphill.d.state.speed+2,'Hills must affect speed');
function stop(wet){const d=run(60,{throttle:1}).d;let distance=0;for(let i=0;i<600&&d.state.speed;i++)distance+=d.step(1/60,{brake:1,wet});assert.equal(d.state.speed,0);return distance}
assert.ok(stop(true)>stop(false)*1.25,'Wet roads must increase braking distance');
const corner=run(60,{throttle:1,curvature:.12});assert.ok(corner.d.state.speed<a.d.state.speed*.7);
const steer=run(60,{throttle:1,steering:1},3).d;
assert.ok(steer.state.heading<-.5,'Right steering must turn the bike');
assert.ok(run(60,{throttle:1,steering:-1},3).d.state.heading>.5,'Left steering must turn the other way');
assert.ok(Math.abs(run(30,{throttle:1,steering:1},3).d.state.heading-run(120,{throttle:1,steering:1},3).d.state.heading)<.02,'Turning must be independent of frame rate');
const heading=steer.state.heading;for(let i=0;i<120;i++)steer.step(1/60,{throttle:1});
assert.ok(steer.state.heading<heading&&Math.abs(steer.state.heading-heading)<.5,'Release must ease out the turn without recentering');
const straightHeading=steer.state.heading;for(let i=0;i<60;i++)steer.step(1/60,{throttle:1});
assert.ok(Math.abs(steer.state.heading-straightHeading)<.002,'Released steering must hold the chosen direction');
steer.reset(Math.PI/2);steer.step(1,{steering:1});assert.equal(steer.state.heading,Math.PI/2,'Stationary steering must not rotate the scooter');
const idle=createDriving(),before={...idle.state};for(const dt of[0,-.1,NaN,Infinity])assert.equal(idle.step(dt,{throttle:1}),0);assert.deepEqual(idle.state,before,'Invalid or zero time must not corrupt physics');
const stationary=createDriving();stationary.state.yawRate=2;stationary.step(1/60);assert.equal(stationary.state.heading,0,'Stopped vehicle must not accumulate invisible turning');assert.equal(stationary.state.yawRate,0);
console.log('Driving checks passed: frame rate, hills, dry/wet braking, corners, free steering.');
