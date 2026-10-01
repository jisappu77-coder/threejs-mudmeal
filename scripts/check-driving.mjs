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
const steer=run(60,{throttle:1,steering:1},3).d;assert.ok(steer.state.offset>0&&steer.state.offset<=3.15);
const offset=steer.state.offset;steer.step(1/60,{});assert.ok(Math.abs(steer.state.offset-offset)<.1,'Steering release must not teleport to road centre');
steer.reset();steer.step(1,{steering:1});assert.equal(steer.state.offset,0,'Stationary steering must not slide the scooter');
const traffic=run(60,{throttle:1,obstacleDistance:2});assert.ok(traffic.d.state.speed<3);
console.log('Driving checks passed: frame rate, hills, dry/wet braking, corners, lane control and traffic response.');
