export type AssetId =
  | 'player.motorcycle'
  | 'player.rider'
  | 'vehicle.autoRickshaw'
  | 'vehicle.bus'
  | 'vehicle.compactCar'
  | 'world.keralaHouseA'
  | 'world.keralaHouseB'
  | 'world.restaurant'
  | 'world.bridge'
  | 'world.palm'
  | 'world.bananaPlant'
  | 'world.utilityPole'
  | 'world.boat'
  | 'world.houseboat';

export type AssetDefinition = {
  id: AssetId;
  url: string;
  scale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export const ASSET_REGISTRY: readonly AssetDefinition[] = [
  { id: 'player.motorcycle', url: 'assets/models/player/motorcycle.glb', castShadow: true },
  { id: 'player.rider', url: 'assets/models/player/rider.glb', castShadow: true },
  { id: 'vehicle.autoRickshaw', url: 'assets/models/vehicles/auto-rickshaw.glb', castShadow: true },
  { id: 'vehicle.bus', url: 'assets/models/vehicles/bus.glb', castShadow: true },
  { id: 'vehicle.compactCar', url: 'assets/models/vehicles/compact-car.glb', castShadow: true },
  { id: 'world.keralaHouseA', url: 'assets/models/world/kerala-house-a.glb', castShadow: true, receiveShadow: true },
  { id: 'world.keralaHouseB', url: 'assets/models/world/kerala-house-b.glb', castShadow: true, receiveShadow: true },
  { id: 'world.restaurant', url: 'assets/models/world/restaurant.glb', castShadow: true, receiveShadow: true },
  { id: 'world.bridge', url: 'assets/models/world/bridge.glb', castShadow: true, receiveShadow: true },
  { id: 'world.palm', url: 'assets/models/vegetation/coconut-palm.glb', castShadow: true },
  { id: 'world.bananaPlant', url: 'assets/models/vegetation/banana-plant.glb', castShadow: true },
  { id: 'world.utilityPole', url: 'assets/models/props/utility-pole.glb', castShadow: true },
  { id: 'world.boat', url: 'assets/models/props/canoe.glb', castShadow: true },
  { id: 'world.houseboat', url: 'assets/models/props/houseboat.glb', castShadow: true },
] as const;

export const ASSET_BY_ID = new Map<AssetId, AssetDefinition>(
  ASSET_REGISTRY.map((definition) => [definition.id, definition]),
);
