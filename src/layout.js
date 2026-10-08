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
