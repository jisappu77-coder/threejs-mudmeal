import * as THREE from 'three';
import {roadRoute} from './real-map-data.js';

export function createMapDelivery({scene,map,player,spawnPoint,height,blocked,stops=[]}){
 const dishes=['Malabar biriyani','Appam & stew','Kerala meals'],state={cash:1240,completed:0,remaining:180,food:100,active:false,finished:false,destination:null,reward:0};
 const marker=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(2.2,.10,8,48),new THREE.MeshBasicMaterial({color:'#efad46',transparent:true,opacity:.85})),pin=new THREE.Mesh(new THREE.ConeGeometry(.65,1.4,16),new THREE.MeshStandardMaterial({color:'#df803a',emissive:'#402010',roughness:.5}));
 ring.rotation.x=Math.PI/2;pin.rotation.z=Math.PI;pin.position.y=3;marker.add(ring,pin);scene.add(marker);let elapsed=0;
 const card=document.querySelector('#delivery'),button=document.querySelector('#deliver'),name=document.querySelector('#dish'),distance=document.querySelector('#distance'),timer=document.querySelector('#timer'),food=document.querySelector('#food'),cash=document.querySelector('#cash'),message=document.querySelector('#delivery-message');
 const guide=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#38d9d4',depthTest:true}));scene.add(guide);let route=[],routeTime=0;
 function updateRoute(){route=state.destination?roadRoute(map,player.position,state.destination):[];guide.geometry.dispose();guide.geometry=new THREE.BufferGeometry().setFromPoints(route.map(p=>new THREE.Vector3(p.x,height(p.x,p.z)+.18,p.z)));guide.visible=!state.finished&&route.length>1;}
 function next(){
  if(stops.length){for(let i=0;i<stops.length;i++){const stop=stops[(state.completed+i)%stops.length];if(Math.hypot(stop.x-player.position.x,stop.z-player.position.z)<25||!roadRoute(map,player.position,stop).length)continue;begin({...stop},Math.round(180+Math.hypot(stop.x-player.position.x,stop.z-player.position.z)*.35),180);return true;}message.textContent='Ride away from this stop to take another delivery';return false;}
  const candidates=map.segments.filter(s=>{const x=(s.a.x+s.b.x)/2,z=(s.a.z+s.b.z)/2,d=Math.hypot(x-player.position.x,z-player.position.z);return s.width>=5.5&&d>120&&d<450});
  if(!candidates.length){message.textContent='Return to town to find another order';return false}
  for(let i=0;i<candidates.length;i++){const s=candidates[(state.completed*41+i)%candidates.length],dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=Math.hypot(dx,dz),x=(s.a.x+s.b.x)/2+dz/l*s.width/4,z=(s.a.z+s.b.z)/2-dx/l*s.width/4;
   if(blocked(x,z,Math.atan2(-dx,-dz)))continue;
   begin({x,z,street:s.name||'Local road'},Math.round(180+Math.hypot(x-player.position.x,z-player.position.z)*.35),180);return true;
  }message.textContent='No clear delivery stop. Try again shortly.';return false;
 }
 function begin(destination,reward,time){state.destination=destination;state.reward=reward;state.remaining=time;state.food=100;state.active=false;state.finished=false;marker.position.set(destination.x,height(destination.x,destination.z)+.18,destination.z);marker.visible=true;name.textContent=dishes[state.completed%3];message.textContent=`Deliver to ${destination.street} · ₹${reward}`;button.textContent='Deliver meal';card.dataset.state='ready';updateRoute();render()}
 function gap(){return state.destination?Math.hypot(player.position.x-state.destination.x,player.position.z-state.destination.z):Infinity}
 function text(el,value){if(el.textContent!==value)el.textContent=value;}
 function render(){text(cash,String(state.cash));text(timer,`${Math.floor(state.remaining/60)}:${String(Math.floor(state.remaining%60)).padStart(2,'0')}`);text(food,String(Math.round(state.food)));text(distance,state.finished?'Order complete':`${Math.round(gap())} m away`);button.disabled=!state.finished&&(gap()>10||state.remaining<=0);guide.visible=!state.finished&&route.length>1;}
 function deliver(){
  if(state.finished)return next();
  if(!state.destination||gap()>10||state.remaining<=0)return false;
  const reward=Math.round(state.reward*(.6+.4*state.food/100));state.cash+=reward;state.completed++;state.finished=true;state.active=false;marker.visible=false;card.dataset.state='complete';message.textContent=`Delivered! +₹${reward} · ${state.completed} completed`;button.textContent='Next order';button.disabled=false;render();return true;
 }
 function update(dt,speed,surface={damage:0}){elapsed+=dt;routeTime+=dt;if(routeTime>2&&speed>.5&&!state.finished){updateRoute();routeTime=0;}if(!state.finished&&state.destination){if(speed>.5)state.active=true;if(state.active){state.remaining=Math.max(0,state.remaining-dt);state.food=Math.max(0,state.food-dt*(.12+(speed>2?surface.damage||0:0)));if(state.remaining===0){state.finished=true;state.active=false;marker.visible=false;card.dataset.state='expired';message.textContent='Order timed out · take another delivery';button.textContent='Next order'}}}pin.position.y=3+Math.sin(elapsed*2)*.18;ring.rotation.z=elapsed*.25;render();}
 button.onclick=deliver;next();return {state,marker,guide,get route(){return route;},next,deliver,update,gap,spawnPoint};
}
