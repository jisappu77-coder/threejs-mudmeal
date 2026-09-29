export type AssetId =
  | 'player.motorcycle'
  | 'vehicle.autoRickshaw'
  | 'vehicle.bus'
  | 'world.keralaHouseA'
  | 'world.restaurant'
  | 'world.palm'
  | 'world.utilityPole';

export type AssetDefinition = {
  id: AssetId;
  url: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export const ASSET_REGISTRY: readonly AssetDefinition[] = [
  { id: 'player.motorcycle', url: 'models/delivery-bike.glb', castShadow: true, receiveShadow: true },
  { id: 'vehicle.autoRickshaw', url: 'models/world/auto-rickshaw.glb', castShadow: true, receiveShadow: true },
  { id: 'vehicle.bus', url: 'models/world/ksrtc-bus.glb', castShadow: true, receiveShadow: true },
  { id: 'world.keralaHouseA', url: 'models/world/kerala-house.glb', castShadow: true, receiveShadow: true },
  { id: 'world.restaurant', url: 'models/world/kerala-shop.glb', castShadow: true, receiveShadow: true },
  { id: 'world.palm', url: 'models/world/coconut-palm.glb', castShadow: true, receiveShadow: true },
  { id: 'world.utilityPole', url: 'models/world/utility-pole.glb', castShadow: true, receiveShadow: true },
] as const;

export const ASSET_BY_ID = new Map<AssetId, AssetDefinition>(
  ASSET_REGISTRY.map((definition) => [definition.id, definition]),
);
