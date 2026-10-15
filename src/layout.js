// Reference coordinates are x east, y north, z up. Three.js uses x, z, -y.
export const worldPoint = (p, origin = [0, 0, 0]) => [p[0] + origin[0], (p[2] || 0) + origin[2], -p[1] - origin[1]];
export function bounds(points) {
  if (typeof points[0] === 'number') return points;
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}
export function normalize(spec, key) {
  let seawall=spec.seawall;
  if(seawall&&!seawall.segments){
    const segments=[];let start=seawall.y[0];
    for(const [a,b]of seawall.platform_access_intervals_y||[]){segments.push([[seawall.x,start],[seawall.x,a]]);start=b;}
    segments.push([[seawall.x,start],[seawall.x,seawall.y[1]]]);seawall={...seawall,segments};
  }
  const buildings = spec.buildings.map(b => {
    const rect = bounds(b.footprint_xy || b.footprint);
    const entrance = b.entrances?.[0]?.position || b.entrance;
    const direction = b.front_direction || (entrance[0] === rect[0] ? 'west' : entrance[0] === rect[2] ? 'east' : entrance[1] === rect[1] ? 'south' : 'north');
    const roof = typeof b.roof === 'string' ? {shape: /hip/.test(b.roof) ? 'hip' : /gable/.test(b.roof) ? 'gable' : 'flat', material: b.roof, ridge_axis: /east-west/.test(b.roof) ? 'east-west' : 'north-south'} : b.roof;
    const height = b.eaves_z_m || b.wall_height_m;
    const loading_door_size_m=b.loading_door_size_m||(spec.phase===1&&['B_SHED','B_WORKSHOP'].includes(b.id)?{width:b.entrances[0].width_m,height:2.6}:undefined);
    const awning=b.awning||(spec.phase===1&&b.id==='B_TEA'?{color:'beige',edge:'south',projection_m:1.2}:undefined);
    return {...b, rect, entrance, direction, roof, height, awning, loading_door_size_m, top: roof.ridge_z_m || b.roof_top_m || b.roof_top_height_m || height + (roof.shape === 'flat' ? .45 : 2)};
  });
  // Keep existing camera URLs stable across the PNG and JPEG reference archives.
  return {...spec, key, origin: spec.scene.zone_origin_m, buildings, seawall, reference_views:spec.reference_views.map(v=>({...v,file:v.file.replace(/\.jpe?g$/i,'.png')})),
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
    if(s.phase===1&&s.paths?.some(p=>p.vehicle_access===false&&inside(lx,ly,p.footprint_xy?bounds(p.footprint_xy):[p.x[0],p.y[0],p.x[1],p.y[1]],radius)))return false;
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

// Phase 1 v2 keeps source geometry; retain the existing Phase 2 calibration.
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
  return spec;
}
