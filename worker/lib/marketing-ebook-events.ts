export type MarketingEbookLiveEvent = {
  ebookId: number;
  version: number;
  updatedAt: string;
};

type Listener = (event: MarketingEbookLiveEvent) => void;

const listenersByEbookId = new Map<number, Set<Listener>>();

export function subscribeToMarketingEbook(
  ebookId: number,
  listener: Listener,
): () => void {
  const listeners = listenersByEbookId.get(ebookId) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByEbookId.set(ebookId, listeners);

  return () => {
    const nextListeners = listenersByEbookId.get(ebookId);
    if (!nextListeners) {
      return;
    }
    nextListeners.delete(listener);
    if (nextListeners.size === 0) {
      listenersByEbookId.delete(ebookId);
    }
  };
}

export function publishMarketingEbookEvent(
  event: MarketingEbookLiveEvent,
): void {
  const listeners = listenersByEbookId.get(event.ebookId);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(event);
  }
}
