export type MarketingAssetLiveEvent = {
  assetId: number;
  version: number;
  updatedAt: string;
};

type Listener = (event: MarketingAssetLiveEvent) => void;

const listenersByAssetId = new Map<number, Set<Listener>>();

export function subscribeToMarketingAsset(
  assetId: number,
  listener: Listener,
): () => void {
  const listeners = listenersByAssetId.get(assetId) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByAssetId.set(assetId, listeners);

  return () => {
    const nextListeners = listenersByAssetId.get(assetId);
    if (!nextListeners) {
      return;
    }
    nextListeners.delete(listener);
    if (nextListeners.size === 0) {
      listenersByAssetId.delete(assetId);
    }
  };
}

export function publishMarketingAssetEvent(
  event: MarketingAssetLiveEvent,
): void {
  const listeners = listenersByAssetId.get(event.assetId);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(event);
  }
}
