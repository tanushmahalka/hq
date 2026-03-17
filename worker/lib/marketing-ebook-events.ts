import {
  publishMarketingAssetEvent,
  subscribeToMarketingAsset,
  type MarketingAssetLiveEvent,
} from "./marketing-asset-events.ts";

export type MarketingEbookLiveEvent = {
  ebookId: number;
  version: number;
  updatedAt: string;
};

export function subscribeToMarketingEbook(
  ebookId: number,
  listener: (event: MarketingEbookLiveEvent) => void,
): () => void {
  return subscribeToMarketingAsset(ebookId, (event: MarketingAssetLiveEvent) => {
    listener({
      ebookId: event.assetId,
      version: event.version,
      updatedAt: event.updatedAt,
    });
  });
}

export function publishMarketingEbookEvent(
  event: MarketingEbookLiveEvent,
): void {
  publishMarketingAssetEvent({
    assetId: event.ebookId,
    version: event.version,
    updatedAt: event.updatedAt,
  });
}
