// Reference coordinates are x east, y north, z up. Three.js uses x, z, -y.
export const worldPoint = (p, origin = [0, 0, 0]) => [p[0] + origin[0], (p[2] || 0) + origin[2], -p[1] - origin[1]];
export function bounds(points) {
  if (typeof points[0] === 'number') return points;
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
export function normalize(spec, key) {
  const buildings = spec.buildings.map(b => {
    const rect = bounds(b.footprint_xy || b.footprint);
    const entrance = b.entrances?.[0]?.position || b.entrance;
    const direction = b.front_direction || (entrance[0] === rect[0] ? 'west' : entrance[0] === rect[2] ? 'east' : entrance[1] === rect[1] ? 'south' : 'north');
    const roof = typeof b.roof === 'string' ? {shape: /hip/.test(b.roof) ? 'hip' : /gable/.test(b.roof) ? 'gable' : 'flat', material: b.roof, ridge_axis: /east-west/.test(b.roof) ? 'east-west' : 'north-south'} : b.roof;
    const height = b.eaves_z_m || b.wall_height_m;
    return {...b, rect, entrance, direction, roof, height, top: roof.ridge_z_m || b.roof_top_m || b.roof_top_height_m || height + (roof.shape === 'flat' ? .45 : 2)};
  });
  return {...spec, key, origin: spec.scene.zone_origin_m, buildings,
    bays: spec.delivery_bays.map(b => ({...b, rect: bounds(b.bounds_xy || b.footprint_xy || b.rect)}))};
}
export function roadWidth(road, y) {
  const profile = road.width_profile;
  if (!profile) return road.width_m;
  if (y <= profile[0].y_m) return profile[0].width_m;
  for (let i = 1; i < profile.length; i++) if (y <= profile[i].y_m) {
    const a = profile[i - 1], b = profile[i], t = (y - a.y_m) / (b.y_m - a.y_m);
    return a.width_m + (b.width_m - a.width_m) * t;
  }
  return profile.at(-1).width_m;
}
export function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}
export function roadDistance(road,x,y){return Math.min(...road.centerline.slice(1).map((point,i)=>segmentDistance(x,y,road.centerline[i],point)));}
export function inside(x, y, r, padding = 0) {
  return x >= r[0] - padding && x <= r[2] + padding && y >= r[1] - padding && y <= r[3] + padding;
}
export function canRide(x, y, layouts, obstacles, radius = .48) {
  for (const o of obstacles) if (inside(x, y, o, radius)) return false;
  for (const s of layouts) {
    const lx = x - s.origin[0], ly = y - s.origin[1], size = s.scene.playable_size_m;
    if (!inside(lx, ly, [0, 0, size.east_west, size.north_south])) continue;
    const water = s.terrain.water_region_xy ? bounds(s.terrain.water_region_xy) : s.terrain.canal_rect;
    if (water && inside(lx, ly, water, radius)) {
      const bridge = s.landmarks?.find(l => l.carriageway_rect);
      if (!bridge || !inside(lx, ly, bridge.carriageway_rect, -radius)) return false;
    }
    return true;
  }
  return false;
}
export function stepBike(state, input, dt, valid) {
  const acceleration = input.forward ? 5 : input.brake ? (state.speed > .15 ? -10 : -3) : -Math.sign(state.speed) * 2.2;
  const before = state.speed;
  state.speed = Math.max(-3, Math.min(12, state.speed + acceleration * dt));
  if (!input.forward && !input.brake && before * state.speed < 0) state.speed = 0;
  state.heading += input.steer * state.speed / 2.2 * .48 * dt;
  // Substeps prevent tunnelling through narrow walls even after a delayed frame.
  const count = Math.max(1, Math.ceil(Math.abs(state.speed * dt) / .15));
  for (let i = 0; i < count; i++) {
    const d = state.speed * dt / count, nx = state.x + Math.sin(state.heading) * d, ny = state.y + Math.cos(state.heading) * d;
    if (!valid(nx, ny)) { state.speed = 0; break; }
    state.x = nx; state.y = ny;
  }
  return state;
}

// The generated player image has a compact waterfront, unlike the approximate JSON camera/widths.
// Keep the source archive untouched; apply one fixed visual calibration to both waterfront blocks.
export function calibrateWaterfront(spec) {
  if(spec.phase===2){const s=structuredClone(spec);
   if(s.scene.id!=='SCENE_03'){s.roads.find(r=>r.id==='R_MAIN').width_m=4.5;for(const c of s.connections)if(/NORTH|SOUTH/.test(c.id))c.width_m=4.5;}
   if(s.scene.id!=='SCENE_03')for(const b of s.buildings){const r=b.footprint,dx=b.entrance[0]===r[2]?52-r[2]:b.entrance[0]===r[0]?68-r[0]:0;b.footprint=[r[0]+dx,r[1],r[2]+dx,r[3]];for(const key of['entrance','secondary_entrance','service_entrance'])if(b[key])b[key][0]+=dx;}
   if(s.scene.id==='SCENE_01'){
    const place=(id,rect,h)=>{const b=s.buildings.find(b=>b.id===id);b.footprint=rect;b.entrance=[id==='B_RESTAURANT_E'||id==='B_APARTMENTS'?rect[0]:rect[2],(rect[1]+rect[3])/2,0];if(b.secondary_entrance)b.secondary_entrance=[(rect[0]+rect[2])/2,rect[1],0];if(h){b.wall_height_m=h;b.roof_top_height_m=h+.45;}};
    place('B_RESTAURANT_W',[36,11,52,25]);s.buildings.find(b=>b.id==='B_RESTAURANT_W').balcony='east';place('B_RESTAURANT_E',[68,11,90,28]);place('B_BAKERY',[43,36,55,46],4.8);place('B_APARTMENTS',[70,36,92,56]);
    s.roads.find(r=>r.id==='R_CROSS').centerline=[[0,50,0],[40,30,0],[96,30,0],[120,50,0]];
    for(const bay of s.delivery_bays){bay.rect=({D_W:[52,13,56,24],D_E:[64,13,68,26],D_B:[55,37,58,45],D_A:[64,38,70,48]})[bay.id]||bay.rect;}
    for(const p of s.props){if(p.id==='P_AUTO')p.position=[66.5,19,0];if(p.id==='P_SCOOTER')p.position=[54,17,0];if(p.id==='P_CAR')p.position=[62,46,0];}
   }
   if(s.scene.id==='SCENE_02'){
    const shop=(id,rect)=>{const b=s.buildings.find(b=>b.id===id),west=id==='B_BAKERY'||id==='B_OFFICE';b.footprint=rect;b.entrance=[west?rect[0]:rect[2],(rect[1]+rect[3])/2,0];if(b.secondary_entrance)b.secondary_entrance=[(rect[0]+rect[2])/2,rect[1],0];};shop('B_SNACK',[34,0,52,20]);shop('B_BAKERY',[68,0,88,28]);shop('B_GROCERY',[34,40,52,55]);shop('B_OFFICE',[68,42,88,62]);
    const stop=s.bus_stop;for(const key of['bay_rect','sidewalk_rect']){stop[key][1]-=18;stop[key][3]-=18;}stop.shelter_rect=[47,23,52,33];stop.bench_position=[49.5,28,0];stop.asphalt_apron_polygon=stop.asphalt_apron_polygon.map(([x,y,z])=>[x,y-18,z]);
    for(const p of s.props){if(p.id==='P_BUS')p.position[1]=25;if(p.id==='P_SCOOTER')p.position=[54,10,0];if(p.id==='P_AUTO')p.position=[66.2,17,0];if(p.id==='P_CAR')p.position[1]=57;}
    for(const bay of s.delivery_bays){const r=({D_SNACK:[52,6,56,17],D_GROCERY:[52,42,56,53],D_BAKERY:[64,8,68,22],D_OFFICE:[64,44,68,59]})[bay.id];if(r)bay.rect=r;}
   }
   if(s.scene.id==='SCENE_04'){
    s.terrain.canal_rect=[0,26,120,42];s.terrain.bank_edges_y=[26,42];const bridge=s.landmarks.find(l=>l.id==='L_BRIDGE');bridge.deck_rect=[56.75,24,63.25,44];bridge.carriageway_rect=[57.75,24,62.25,44];bridge.abutment_bank_y=[26,42];
    for(const b of s.buildings){const first=['B_TEA','B_BAKERY'].includes(b.id),dy=first?-12:-26;b.footprint[1]+=dy;b.footprint[3]+=dy;for(const key of['entrance','secondary_entrance'])if(b[key])b[key][1]+=dy;}
    for(const p of s.props){if(p.id==='P_SCOOTER')p.position=[54,9,0];if(p.id==='P_AUTO')p.position=[66.5,16,0];if(p.id==='P_SKIFF')p.position=[20,34,-1];}for(const bay of s.delivery_bays){bay.rect[1]=6;bay.rect[3]=18;}
   }
   if(s.scene.id==='SCENE_03'){
    for(const b of s.buildings){const dy=b.entrance[1]===b.footprint[1]?-11:8;b.footprint[1]+=dy;b.footprint[3]+=dy;for(const key of['entrance','secondary_entrance','service_entrance'])if(b[key])b[key][1]+=dy;}
    s.delivery_bays.find(b=>b.id==='D_LOADING').rect=[8,53.5,30,57];s.delivery_bays.find(b=>b.id==='D_MARKET').rect=[8,44,30,47];for(const p of s.props){if(p.id==='P_TRUCK')p.position[1]=55.4;if(p.id==='P_AUTO')p.position[1]=46;}
   }
   if(s.scene.id==='SCENE_04')for(const p of s.props)if(/player|rider/.test(p.type.toLowerCase()))p.position[0]=58;
   if(s.scene.id!=='SCENE_01'&&s.scene.id!=='SCENE_03')for(const bay of s.delivery_bays){if(bay.rect[2]<=60){bay.rect[0]=52;bay.rect[2]=56;}else{bay.rect[0]=64;bay.rect[2]=68;}}
   for(const p of s.props)if(/player|rider/.test(p.type.toLowerCase())&&p.heading==='north'&&s.scene.id!=='SCENE_04')p.position[0]=59.5;
   return s;
  }
  if(spec.phase===1&&!spec.terrain.water_region_xy){const s=structuredClone(spec);
   function move(id,dx,dy){const b=s.buildings.find(b=>b.id===id);b.footprint_xy=b.footprint_xy.map(([x,y])=>[x+dx,y+dy]);if(b.compound){for(const key of['boundary_xy','footprint_xy'])if(b.compound[key])b.compound[key]=b.compound[key].map(([x,y])=>[x+dx,y+dy]);if(b.compound.gate_position)b.compound.gate_position=[b.compound.gate_position[0]+dx,b.compound.gate_position[1]+dy,...b.compound.gate_position.slice(2)];}for(const e of b.entrances)e.position=[e.position[0]+dx,e.position[1]+dy,...e.position.slice(2)];for(const bay of s.delivery_bays)if(bay.target_building_id===id||b.entrances.some(e=>e.id===bay.target)){const key=bay.bounds_xy?'bounds_xy':'footprint_xy';bay[key]=bay[key].map(([x,y])=>[x+dx,y+dy]);}}
   if(s.scene.id==='SCENE_03'){const home=s.buildings.find(b=>b.id==='B_HOME');home.eaves_z_m=4.2;home.roof.ridge_z_m=6.5;s.buildings.find(b=>b.id==='B_CHAPEL').bell_tower.height_m=16;move('B_CAFE',0,2);move('B_BAKERY',0,2);move('B_HOME',0,-4);move('B_TEA',0,-3);const auto=s.props.find(p=>p.id==='V_AUTO');auto.id='REFERENCE_AUTO';auto.position=[44,36.5,0];auto.heading='west';s.props.push({id:'REFERENCE_CAR',type:'silver compact car',position:[28,33.5,0],heading:'west'});}
   if(s.scene.id==='SCENE_04'){s.buildings.find(b=>b.id==='B_RESTAURANT').balcony='west upper balcony';move('B_GROCERY',7,0);move('B_RESTAURANT',-8,0);move('B_CLOTHING_HOME',7,0);move('B_BAKERY',-8,0);for(const b of s.buildings)if(['B_GROCERY','B_RESTAURANT'].includes(b.id)){b.footprint_xy[0][1]=b.footprint_xy[1][1]=0;}s.props.find(p=>p.id==='V_SCOOTER').position=[45,21,0];for(const p of s.props)if(/STALLS|CRATES/.test(p.id))p.position[0]=46;const auto=s.props.find(p=>p.id==='V_AUTO');auto.position=[52,38,0];auto.heading='south';}
   return s;
  }
  if(spec.phase!==1)return spec;
  const s=structuredClone(spec),east=x=>x>76?76+(x-76)*.38:x,point=p=>[east(p[0]),...p.slice(1)],polygon=ps=>ps.map(point);
  const cafe=s.buildings.find(b=>b.id==='B_CAFE');if(cafe){cafe.eaves_z_m=4.8;cafe.roof.ridge_z_m=8.2;cafe.footprint_xy=[[50.1,29.3],[64.1,29.3],[64.1,35.4],[50.1,35.4]];cafe.entrances[0].position=[64.1,33,0];cafe.entrances[1].position=[57.1,29.3,0];const bay=s.delivery_bays.find(b=>b.id==='BAY_CAFE');if(bay)bay.bounds_xy=bay.bounds_xy.map(([x,y])=>[x+.1,y+11]);}
  if(s.scene.id==='SCENE_01'){
   const bakery=s.buildings.find(b=>b.id==='B_BAKERY');bakery.footprint_xy=[[57.5,52],[67,52],[67,60],[57.5,60]];bakery.eaves_z_m=4.7;bakery.entrances[0].position=[67,56,0];bakery.entrances[1].position=[62,52,0];const bay=s.delivery_bays.find(b=>b.id==='BAY_BAKERY');if(bay)bay.bounds_xy=[[67.5,54],[70,54],[70,60],[67.5,60]];const west=s.roads.find(r=>r.id==='R_WEST');west.centerline=west.centerline.map(([x,y,z])=>[x,44,z]);s.connections.find(c=>c.id==='C_WEST_ROAD').position=[0,44,0];for(const p of s.props){if(p.id==='V_SCOOTER')p.position=[67.7,26,0];if(p.id==='V_AUTO')p.position=[68.5,56,0];}
  }
  if(s.scene.id==='SCENE_01'){const pier=s.landmarks.find(l=>l.id==='L_PIER');pier.footprint_xy= pier.footprint_xy.map(([x,y])=>[x,y-16]);pier.canopy.footprint_xy=pier.canopy.footprint_xy.map(([x,y])=>[x,y-16]);s.seawall.segments=[[[88,0],[88,32]],[[88,36],[88,100]]];s.seawall.opening_for_pier_y=[32,36];const bay=s.delivery_bays.find(b=>b.id==='BAY_PIER');bay.bounds_xy=bay.bounds_xy.map(([x,y])=>[x,y-16]);}
  if(s.scene.id==='SCENE_02'){
   s.buildings.find(b=>b.id==='B_SEAFOOD').roof.ridge_z_m=7.3;const provision=s.buildings.find(b=>b.id==='B_PROVISION');provision.eaves_z_m=8.2;provision.footprint_xy=[[58,44],[67,44],[67,55],[58,55]];provision.walls='teal plaster';provision.entrances[0].position=[67,49.5,0];provision.entrances[1].position=[62.5,44,0];s.delivery_bays.find(b=>b.id==='BAY_PROVISION').bounds_xy=[[67,46],[70,46],[70,53],[67,53]];
   for(const l of s.landmarks){const y=l.id==='L_NET_01'?45:76;l.platform_footprint_xy=[[88,y-4],[110,y-4],[110,y+4],[88,y+4]];l.pivot_position=[94.5,y,7.5];l.counterweights_position=[89.5,y,2.5];l.boom_reach_east_m=9;l.mesh.approx_span_m=9;}
   s.seawall.platform_access_intervals_y=[[41,49],[72,80]];
  }
  const main=s.roads.find(r=>r.id==='R_MAIN');if(main){main.width_m=6.2;main.centerline=main.centerline.map(p=>[p[0]+.4,p[1]]);}for(const c of s.connections)if(c.id.includes('_ROAD')&&c.width_m===8){c.width_m=6.2;c.position[0]+=.4};for(const p of s.props)if(/player|rider/.test(p.type.toLowerCase()))p.position[0]=71.5;
  s.terrain.water_region_xy=polygon(s.terrain.water_region_xy).map(p=>[p[0]>90?s.scene.playable_size_m.east_west:p[0],p[1]]);
  for(const p of s.paths||[]){if(p.footprint_xy)p.footprint_xy=polygon(p.footprint_xy);if(p.x)p.x=p.x.map(east);if(p.width_m)p.width_m*=.38;}
  for(const v of s.vegetation){v.position=point(v.position);if(s.scene.id==='SCENE_01'&&/palm/.test(v.species||v.type)){const placement=({14:[76.45,25.13,6.4],38:[77.46,38.23,7.5],72:[78.8,68.7,8.5],92:[80,94,8.5]})[v.position[1]];if(placement){v.position=[placement[0],placement[1],0];v.height_m=placement[2];}}}
  for(const p of s.props){if(p.position)p.position=point(p.position);if(p.positions)p.positions=polygon(p.positions);if(s.scene.id==='SCENE_01'&&p.id==='P_BENCH_01')p.position=[77.5,24,0];}
  for(const l of s.landmarks||[]){for(const key of ['footprint_xy','platform_footprint_xy'])if(l[key])l[key]=polygon(l[key]);for(const key of ['pivot_position','counterweights_position'])if(l[key])l[key]=point(l[key]);if(l.canopy?.footprint_xy)l.canopy.footprint_xy=polygon(l.canopy.footprint_xy);}
  if(s.seawall?.segments)s.seawall.segments=s.seawall.segments.map(polygon);
  else if(s.seawall?.x){s.seawall.x=east(s.seawall.x);const [lo,hi]=s.seawall.y,intervals=s.seawall.platform_access_intervals_y||[],segments=[];let start=lo;for(const [a,b]of intervals){segments.push([[s.seawall.x,start],[s.seawall.x,a]]);start=b}segments.push([[s.seawall.x,start],[s.seawall.x,hi]]);s.seawall.segments=segments;}
  for(const bay of s.delivery_bays)if(bay.bounds_xy)bay.bounds_xy=polygon(bay.bounds_xy);
  for(const c of s.connections)if(c.position[0]>76){c.position=point(c.position);c.width_m*=.38;}
  return s;
}
