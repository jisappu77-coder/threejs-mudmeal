import * as THREE from 'three';

export function createExtensionRoad(){
 const V=(x,z,y=0)=>new THREE.Vector3(x,y+.16,z);
 const extension=new THREE.CatmullRomCurve3([
  V(26,-18.3),V(28,-36),V(58,-54),V(97,-49),V(128,-15),V(137,19),V(130,58),V(103,91),V(55,115),V(5,98),V(-57,86),V(-110,30),V(-100,-20),V(-80,-62),V(-63,-96,8),V(-48,-124,16),V(-20,-132,20),V(10,-150,24),V(31,-120,18),V(0,-90,7),V(-18,-40),
 ],false,'centripetal');
 const roadPoints=extension.getPoints(1100);
 // Cubic height interpolation can dip below flat ground before a climb.
 for(const p of roadPoints)p.y=Math.max(.16,p.y);
 return {curve:extension,points:roadPoints};
}

// Districts are authored separately so instanced scenery can be culled outside the view.
export function createExtendedWorld(h) {
 const {scene,M,mat,box,cyl,ell,bar,put,mesh,flush,building:baseBuilding,roof,palm,banana,shrub,person,pot,crate,table,chair,addSign,fence,rand,riceGeometry,riceMaterials,waterMaterial,setHeight,spawnVehicle,reservePlot,plotBlocked,waterAt,getHeight,registerWater}=h;
 const footprints=[];
 function building(x,z,w,d,...args){footprints.push({x,z,w,d});return baseBuilding(x,z,w,d,...args)}
 const districts=[
  {id:'kochi',name:'Kochi Outskirts',x:3,z:20,y:0},
  {id:'backwaters',name:'Backwater Tea Shop',x:58,z:-54,y:0},
  {id:'paddy',name:'Paddy Trails',x:128,z:-15,y:0},
  {id:'village',name:'Kerala Village',x:130,z:58,y:0},
  {id:'port',name:'Kochi Port',x:55,z:115,y:0},
  {id:'ferry',name:'Ferry Landing',x:5,z:98,y:0},
  {id:'coast',name:'Lighthouse Coast',x:-110,z:30,y:0},
  {id:'fort-kochi',name:'Fort Kochi Market',x:-80,z:-62,y:0},
  {id:'hills',name:'Hill Road',x:-48,z:-124,y:16},
  {id:'viewpoint',name:'Backwater Viewpoint',x:10,z:-150,y:24},
 ];
 const V=(x,z,y=0)=>new THREE.Vector3(x,y+.16,z);
 const {curve:extension,points:roadPoints}=h.extensionLayout;
 for(const area of [{x:89,z:-92,w:78,d:64,ellipse:true},{x:-247,z:-15,w:200,d:390},{x:56,z:155,w:95,d:20},{x:2,z:114,w:28,d:24}])registerWater(area);
 function roadRibbon(width,lift,material){
  const vertices=[],uv=[],indices=[];
  roadPoints.forEach((p,i)=>{const a=roadPoints[Math.max(0,i-1)],b=roadPoints[Math.min(roadPoints.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.max(.0001,Math.hypot(dx,dz));for(const s of[-1,1]){vertices.push(p.x+s*dz/l*width/2,p.y-.16+lift,p.z-s*dx/l*width/2);uv.push(s===-1?0:1,i*.18)}if(i<roadPoints.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3)}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();mesh(g,material);
 }
 box(M.grass,55,-.65,-5,370,1.2,350);
 roadRibbon(9.2,.025,M.curb);roadRibbon(8.4,.055,M.road);
 for(let i=0;i<roadPoints.length-1;i+=5){const p=roadPoints[i],q=roadPoints[i+1],angle=Math.atan2(q.x-p.x,q.z-p.z);box(M.line,p.x,p.y-.09,p.z,.13,.012,1.15,null,angle);for(const s of[-1,1]){const x=p.x+s*Math.cos(angle)*4.45,z=p.z-s*Math.sin(angle)*4.45;box(M.white,x,p.y+.11,z,.24,.28,1.1,null,angle);if(i%15===0){reservePlot('pole',x,z,.2,.2);cyl(M.darkWood,x,p.y+.68,z,.055,1.35);if(i+15<roadPoints.length){const next=roadPoints[i+15],after=roadPoints[Math.min(i+16,roadPoints.length-1)],angle2=Math.atan2(after.x-next.x,after.z-next.z);bar(M.wood,[x,p.y+1,z],[next.x+s*Math.cos(angle2)*4.45,next.y+1,next.z-s*Math.sin(angle2)*4.45],.04)}}}}
 // A continuous raised terrain surface follows the northern hill road.
 const hillSamples=roadPoints.filter(p=>p.y>1),terrain=new THREE.PlaneGeometry(180,105,100,60);terrain.rotateX(-Math.PI/2);terrain.translate(-40,0,-132.5);
 function hillHeight(x,z){let d=Infinity,level=0;for(const p of hillSamples){const q=(p.x-x)**2+(p.z-z)**2;if(q<d){d=q;level=p.y-.30}}return Math.max(-.05,level*Math.exp(-d/350)-.07)}
 const positions=terrain.attributes.position;
 for(let i=0;i<positions.count;i++)positions.setY(i,hillHeight(positions.getX(i),positions.getZ(i)));terrain.computeVertexNormals();mesh(terrain,mat('#617d3f'));
 // Lake, sea, beaches and islands are geometry, never a photographic backdrop.
 box(M.soil,-140,-.11,-15,22,.22,330);
 box(waterMaterial,-247,-.15,-15,200,.22,390);
 const lake=new THREE.CircleGeometry(1,96);lake.rotateX(-Math.PI/2);const lakeMesh=mesh(lake,waterMaterial);lakeMesh.position.set(89,.025,-92);lakeMesh.scale.set(39,1,32);
 for(let i=0;i<15;i++){const x=rand(65,112),z=rand(-105,-69);ell(M.grass,x,.12,z,rand(1,2.5),.23,rand(.5,1.8));}
 flush();
 function nearRoad(x,z,min=7){return roadPoints.some(p=>Math.hypot(p.x-x,p.z-z)<min)}
 function greenery(d,count=20){for(let i=0;i<count;i++){const x=d.x+rand(-23,23),z=d.z+rand(-24,24);if(nearRoad(x,z,8)||(d.id==='backwaters'&&((x-89)/39)**2+((z+92)/32)**2<1))continue;setHeight(d.y?hillHeight(x,z):0);if(i%4===0)palm(x,z,rand(7,11));else if(i%3===0)banana(x,z,rand(.7,1.2));else shrub(x,z,rand(.8,2))}setHeight(d.y)}
 function board(text,x,z){
  let index=0,closest=Infinity;for(let i=0;i<roadPoints.length;i++){const p=roadPoints[i],d=(x+1.4-p.x)**2+(z-p.z)**2;if(d<closest){closest=d;index=i;}}
  let cx,cz,yaw,normal,right;
  search:for(const flip of [1,-1])for(const shift of [0,15,-15,30,-30,60,-60]){
   const i=THREE.MathUtils.clamp(index+shift,0,roadPoints.length-1),p=roadPoints[i],a=roadPoints[Math.max(0,i-1)],b=roadPoints[Math.min(roadPoints.length-1,i+1)];normal=new THREE.Vector3(b.z-a.z,0,a.x-b.x).normalize();
   const side=((x+1.4-p.x)*normal.x+(z-p.z)*normal.z<0?-1:1)*flip;cx=p.x+normal.x*side*6.8;cz=p.z+normal.z*side*6.8;yaw=Math.atan2(-normal.x*side,-normal.z*side);right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
   if(!waterAt(cx,cz)&&!plotBlocked(cx,cz,1.9))break search;
  }
  const previous=getHeight();if(previous>1)setHeight(hillHeight(cx,cz));
  reservePlot('sign',cx,cz,Math.abs(right.x)*3.3+Math.abs(normal.x)*.4,Math.abs(right.z)*3.3+Math.abs(normal.z)*.4);
  for(const s of[-1,1])cyl(M.wood,cx+right.x*s*1.4,1.1,cz+right.z*s*1.4,.065,2.2);
  addSign(text,cx,2,cz,3.3,1.25,'#173e35','#f6e8c8',43,yaw);setHeight(previous);
 }
 const boats=[];
 function houseboat(x,z,angle=0){
  const g=new THREE.Group();g.position.set(x,.13,z);g.rotation.y=angle;scene.add(g);boats.push(g);
  ell(M.darkWood,0,.17,0,2.1,.42,6.4,g);box(M.wood,0,.48,0,3.4,.18,10.3,g);box(M.cream,0,1.65,-.5,3,2.05,6.5,g);
  const canopy=new THREE.CylinderGeometry(2.3,2.3,7.9,40,1,true,0,Math.PI);canopy.rotateZ(Math.PI/2);canopy.rotateY(Math.PI/2);put(canopy,mat('#ac8c4f'),[0,2,-.5],[1,1,1],[0,0,0],g);
  for(let zz=-4.3;zz<3.5;zz+=.23)bar(M.darkWood,[-1.85,2.1,zz],[1.85,2.1,zz],.025,g);
  for(const s of[-1,1]){for(let zz=-2.8;zz<=2.6;zz+=1.25){box(M.glass,s*1.51,1.9,zz,.03,.9,.85,g);box(M.wood,s*1.54,1.9,zz-.5,.035,1.1,.055,g)}for(let zz=-5;zz<5.2;zz+=.8){cyl(M.wood,s*1.55,1.1,zz,.045,1.1,g);if(zz<4.5)bar(M.wood,[s*1.55,1.6,zz],[s*1.55,1.6,zz+.8],.04,g)}}
  box(M.wood,0,.8,4.4,1.8,.12,.7,g);addSign('KETTUVALLAM',0,2.1,3.01,2.7,.45,'#5f4328','#f5dfaa',48,0,g);return g;
 }
 for(const d of districts.slice(1)){
  setHeight(d.y);
  switch(d.id){
   case 'backwaters':
    building(57,-67,8,6,3.6,'#d9c291',true);addSign('KETTUVALLAM\nTEA SHOP',57,3,-63.9,7,1.15,'#4c3824','#f7e2a0',46);
    box(M.wood,58,.1,-62,13,.2,3);setHeight(.2);for(let i=0;i<3;i++){table(53+i*3,-61.7);chair(53+i*3,-60.8);person(53+i*3,-60.8,['#c87538','#548c91','#efe4c6'][i],true)}setHeight(0);
    for(const [x,z,a]of[[77,-72,.5],[97,-90,-.35],[78,-97,.8]])houseboat(x,z,a);
    reservePlot('pier',68.45,-66,6.3,1.8);
    for(let i=0;i<8;i++){box(M.wood,66+i*.7,.18,-66, .66,.2,1.8);cyl(M.wood,66+i*.7,-.4,-66,.08,1.3)}
    break;
   case 'paddy':
    for(let plot=0;plot<6;plot++){const x=146+(plot%2)*13,z=-36+Math.floor(plot/2)*14;box(mat('#648e32'),x,.03,z,12,.14,12);box(M.soil,x,.18,z+6,13,.3,.6);for(let i=0;i<1050;i++)put(riceGeometry,riceMaterials[i%3],[x-5.55+(i%35)*.32+rand(-.035,.035),.12,z-5.6+Math.floor(i/35)*.38+rand(-.035,.035)],[1,rand(.55,1.05),1],[0,rand(0,6.28),0]);fence([[x-6,z-6],[x-6,z],[x-6,z+6]])}
    board('PADDY TRAILS',136,-12);person(139,-10,'#f5e2b1');person(152.5,-29,'#b79554');break;
   case 'village':
    for(let i=0;i<6;i++){const x=153+(i%2)*12,z=43+Math.floor(i/2)*14;building(x,z,7,6,3.3,['#efd29a','#ded6b7','#d79f7a'][i%3]);pot(x-2,z+4);banana(x+5,z+2);person(x,z+4,'#a77552');crate(x+2,z+4)}
    board('KERALA VILLAGE',136,58);break;
   case 'port':{
    box(mat('#90968e'),58,.04,133,70,.16,26);box(waterMaterial,56,-.13,155,95,.22,20);
    for(let i=0;i<18;i++){const x=34+(i%6)*8,z=123+Math.floor(i/6)*6;const c=mat(['#b84a37','#3a7881','#d79c3e'][i%3]);reservePlot('cargo',x,z,7.2,3.2);box(c,x,1.5,z,7,2.8,3);for(let j=0;j<13;j++)box(M.darkWood,x-3+j*.5,1.5,z+1.51,.035,2.7,.03)}
    for(const x of[36,65,88]){for(const s of[-1,1])bar(M.yellow,[x+s*2,0,137],[x+s*.6,16,140],.27);bar(M.yellow,[x,15,140],[x+14,22,150],.26);bar(M.yellow,[x,15,140],[x-6,20,131],.26);bar(M.black,[x+14,22,150],[x+14,5,150],.04);box(M.yellow,x,14,140,2.2,2,2)}
    ell(M.darkWood,56,.5,157,17,1.5,5);box(M.white,44,3,157,6,4,5);box(M.red,58,2.6,157,15,2.5,5);board('KOCHI PORT',51,121);break;}
   case 'ferry':
    footprints.push({x:-9,z:108,w:8,d:11});reservePlot('building',-9,108,8.85,11.85);
    box(waterMaterial,2,-.1,114,28,.24,24);box(M.stone,-9,.2,108,8,.5,11);for(const x of[-12,-6])for(let z=104;z<114;z+=2){cyl(M.chrome,x,.95,z,.06,1.4);bar(M.chrome,[x,1.6,z],[x,1.6,z+2],.035)}
    box(M.wood,-3,.45,113,7,.2,2);box(M.darkWood,3,.3,115,9,.7,16);box(M.cream,3,1,115,8,.4,13);box(M.white,3,2.8,121,7,3,3);box(M.glass,3,3,122.55,5.7,1,.03);addSign('KOCHI FERRY',3,4.2,122.6,6,.65,'#234c53','#ffe8ab',47);board('FERRY LANDING',12,98);spawnVehicle('van',3,115,Math.PI,'#e4d7a9').position.y=1.165;break;
   case 'coast':
    reservePlot('building',-133,39,5,5);
    cyl(M.white,-133,5.5,39,2,11);for(const y of[2,6,10])cyl(M.red,-133,y,39,2.03,1.2);cyl(M.chrome,-133,11.7,39,2.3,.2);cyl(M.glass,-133,12.7,39,1.5,2);cyl(M.red,-133,13.8,39,2,.25);put(new THREE.ConeGeometry(2.3,1.2,40),M.red,[-133,14.5,39]);
    board('LIGHTHOUSE COAST',-117,42);for(let z=-10;z<76;z+=10)palm(-122,z,rand(8,11));
    for(let i=0;i<16;i++){const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);const wave=mesh(g,new THREE.MeshBasicMaterial({color:'#e5f4e9',transparent:true,opacity:.24,depthWrite:false}));wave.position.set(-143-i*.8,.05,-15+i*8);wave.scale.set(.45,1,14)}break;
   case 'fort-kochi':
    footprints.push({x:-119,z:-47,w:9,d:10});reservePlot('building',-119,-47,9.5,10.5);
    for(let i=0;i<6;i++){
     const x=-106,z=-85+i*9,title=['SPICE MARKET','BAKERY','FORT CHAYA'][i%3];building(x,z,7,6,5,['#e0c07b','#d4d8cf','#d99e72'][i%3],true);
     box(M.darkWood,x+3.54,1.55,z,.12,2.7,5.2);box(M.glass,x+3.62,1.55,z,.03,2.35,4.9);
     for(let zz=-2.4;zz<2.6;zz+=1.2)box(M.wood,x+3.65,1.6,z+zz,.08,2.6,.09);
     for(let zz=-3;zz<3;zz+=.4)box(i%2?M.cream:mat('#508d8d'),x+4.2,2.9,z+zz,1.45,.12,.37);
     addSign(title,x+3.65,3.65,z,6,.85,'#3f6458','#f3e6c0',40,Math.PI/2);crate(x+4.8,z-1.5);pot(x+4.8,z+2);person(x+4.7,z,['#bb7139','#467e89','#ecd7ae'][i%3]);
    }
    box(M.white,-119,4.3,-48,9,8.6,7);roof(-119,-48,9.5,7.5,8.6,3);box(M.white,-119,8.5,-43.7,2.8,17,3);put(new THREE.ConeGeometry(2.2,3.7,32),mat('#737a70'),[-119,18.7,-43.7]);bar(M.darkWood,[-119,20,-43.7],[-119,22,-43.7],.09);bar(M.darkWood,[-119.7,21.4,-43.7],[-118.3,21.4,-43.7],.09);
    box(M.wood,-119,1.8,-42.15,1.8,3.5,.12);for(const x of[-122,-116]){box(M.glass,x,4.8,-44.45,1,2.6,.08);bar(M.cream,[x,3.6,-44.3],[x,6,-44.3],.04)}board('FORT KOCHI',-85,-54);break;
   case 'hills':
    box(M.stone,-59,-1.5,-126,8,3,6);building(-59,-126,7,5,3,'#e3c782',true);addSign('HILL ROAD\nCHAYA & SNACKS',-59,2.3,-123.4,6,1.1,'#733e26','#ffe3ad',42);box(M.stone,-58,-1.5,-122,10,3,5);box(M.curb,-58,-.08,-122,10,.16,5);table(-58,-122);chair(-58,-121);person(-58,-121,'#ddaa69',true);board('VIEWPOINT  →',-53,-120);break;
   case 'viewpoint':
    box(M.stone,10,-3.2,-164,23,6.4,9);box(M.curb,10,.05,-164,23,.25,9);fence([[-1,-168],[6,-168],[14,-168],[21,-168]]);for(const x of[3,12]){box(M.wood,x,.55,-165,3,.12,.6);for(const s of[-1,1])box(M.chrome,x+s,.25,-165,.09,.5,.4);setHeight(24.175);person(x,-164,'#839daf');setHeight(24)}
    board('BACKWATER VIEWPOINT',5,-158);break;
  }
  greenery(d,d.y?12:24);flush();setHeight(0);
 }
 // Vegetation along the connecting roads keeps transitions populated.
 for(let i=6;i<roadPoints.length-6;i+=9){
  const p=roadPoints[i],q=roadPoints[i+1],angle=Math.atan2(q.x-p.x,q.z-p.z);
  for(const side of[-1,1]){
   const distance=rand(9,15),x=p.x+Math.cos(angle)*side*distance,z=p.z-Math.sin(angle)*side*distance;
   if(x<-129||((x-89)/39)**2+((z+92)/32)**2<1||(z>123&&x>-10&&x<108)||districts.some(d=>Math.hypot(d.x-x,d.z-z)<23))continue;
   setHeight(z<-80&&x<50?hillHeight(x,z):0);
   if(i%27===6)palm(x,z,rand(7,10));else if(i%18===6)banana(x,z,.9);else shrub(x,z,rand(1,2));
   for(let j=0;j<3;j++)shrub(x+rand(-3,3),z+rand(-3,3),rand(.7,1.4));
  }
  // Short groups keep distant foliage independently culled.
  if(i%90===6)flush();
 }
 flush();setHeight(0);
 const original=[...[28,20,12,6].map(z=>{const p=h.roadFrame(z,-2.2);return V(p.x,p.z,-.03)}),V(3.4,2.3),V(6,-9.7,1.13),V(16.4,-9.7,1.13),V(18.2,-14),V(26,-18.3)];
 const returnRoad=[-28,-18,-8,4,12,20].map(z=>{const p=h.roadFrame(z,2.2);return V(p.x,p.z,-.03)});
 const route=new THREE.CatmullRomCurve3([...original,...extension.points.slice(1),...returnRoad],true,'centripetal');
 // getPointAt makes speed independent of the differently spaced control points.
 for(const d of districts){let nearest=Infinity;for(let i=0;i<2400;i++){const t=i/2400,p=route.getPointAt(t),dist=(p.x-d.x)**2+(p.z-d.z)**2;if(dist<nearest){nearest=dist;d.routeT=t}}}
 const rainPositions=new Float32Array(900*6);for(let i=0;i<900;i++){const x=rand(-25,25),y=rand(0,30),z=rand(-25,25);rainPositions.set([x,y,z,x-.12,y-.9,z],i*6)}
 const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
 const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#aed2e3',transparent:true,opacity:.38,depthWrite:false}));rain.visible=false;scene.add(rain);
 const headlight=new THREE.SpotLight('#fff0c6',0,42,.6,.5,1);scene.add(headlight,headlight.target);
 let weather='day';
 const hemisphere=scene.children.find(o=>o.isHemisphereLight);
 function setWeather(value){weather=['day','sunset','rain'].includes(value)?value:'day';const night=weather==='rain',sunset=weather==='sunset';scene.background.set(night?'#111e30':sunset?'#d5b197':'#a8cbd6');scene.fog.color.copy(scene.background);h.sun.color.set(sunset?'#ffbc77':'#fff2db');h.sun.intensity=night?.35:sunset?2.1:3;hemisphere.intensity=night?.7:1.25;scene.environmentIntensity=night?.17:.35;M.road.roughness=night?.22:.83;M.glass.emissive.set(night?'#df9a40':'#000000');M.glass.emissiveIntensity=night?.45:0;rain.visible=night;headlight.intensity=night?45:0;h.renderer.toneMappingExposure=night?1.25:1.02;document.querySelector('#weather-label').textContent=night?'RAIN · NIGHT':sunset?'GOLDEN HOUR':'CLEAR · DAY'}
 function update(elapsed,player){
  // A cached shadow map must use the same light pose as the visible frame.
  if(h.sun.target.position.distanceToSquared(player.position)>1e-10)h.sun.shadow.needsUpdate=true;
  h.sun.target.position.copy(player.position);h.sun.position.copy(player.position).add(new THREE.Vector3(-30,55,28));
  rain.position.set(player.position.x,player.position.y-((elapsed*11)%15),player.position.z);
  headlight.position.copy(player.position);headlight.position.y+=1.2;headlight.target.position.copy(player.position).add(new THREE.Vector3(-Math.sin(player.rotation.y)*16,.1,-Math.cos(player.rotation.y)*16));
  for(let i=0;i<boats.length;i++){boats[i].position.y=.13+Math.sin(elapsed*.7+i)*.025;boats[i].rotation.z=Math.sin(elapsed*.45+i)*.003}
 }
 setWeather('day');
 return {districts,footprints,route,roadPoints,groundHeight:hillHeight,setWeather,update,get weather(){return weather},nearest(position){return districts.reduce((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)<Math.hypot(b.x-position.x,b.z-position.z)?a:b)}};
}

