import { apiRequest, arrayOf, record, textOf, valueOf } from "@/lib/api-client";
import { sharedAssetKind } from "../assets/AssetPresentation";

export async function loadTargetShareSelection(targetType: "friend" | "group", targetId: string): Promise<Record<string, unknown>[]> {
  const [selectionResponse, sharedResponse] = await Promise.all([
    apiRequest(`share/${targetType}/${targetId}/selection`),
    apiRequest(`${targetType}/${targetId}/item/`)
  ]);
  const sharedRecords = arrayOf(sharedResponse, ["data", "items"]);
  const shareIdByAsset = new Map<string, string>();
  const shareIdsByAssetId = new Map<string, string[]>();

  sharedRecords.forEach((share) => {
    const asset = record(valueOf(share, "asset_detail")) ?? share;
    const assetId = textOf(asset, "id", "ID");
    const shareId = textOf(share, "group_item_id", "shared_item_id");
    if (!assetId || !shareId) return;
    const type = textOf(share, "type") || textOf(asset, "type");
    if (type) shareIdByAsset.set(`${type.toLowerCase()}:${assetId}`, shareId);
    const candidates = shareIdsByAssetId.get(assetId) ?? [];
    candidates.push(shareId);
    shareIdsByAssetId.set(assetId, candidates);
  });

  return arrayOf(selectionResponse, ["items", "data"]).map((item) => {
    const assetId = textOf(item, "id", "ID");
    const type = textOf(item, "type", "item_type").toLowerCase();
    const matchingShareId = shareIdByAsset.get(`${type}:${assetId}`)
      ?? (shareIdsByAssetId.get(assetId)?.length === 1 ? shareIdsByAssetId.get(assetId)?.[0] : undefined)
      ?? textOf(item, "group_item_id", "shared_item_id");
    return {
      ...item,
      is_shared: valueOf(item, "is_shared") === true || Boolean(matchingShareId),
      shared_item_id: matchingShareId ?? ""
    };
  });
}

export function shareableAssetKey(asset: Record<string, unknown>): string {
  return `${sharedAssetKind(asset) ?? textOf(asset, "type", "item_type").toLowerCase()}:${textOf(asset, "id", "ID")}`;
}
