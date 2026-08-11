export type ProcessedCentralDocument = {
  instanceId: string;
  inboxItemId: string;
  resultIndex: number;
};

export type CentralDeliveryBatch = {
  instanceId: string;
  inboxItemIds: string[];
  resultIndexes: number[];
};

export function groupCentralDeliveries(documents: ProcessedCentralDocument[]): CentralDeliveryBatch[] {
  const batches = new Map<string, { inboxItemIds: Set<string>; resultIndexes: Set<number> }>();

  for (const document of documents) {
    if (!document.instanceId || !document.inboxItemId) continue;

    const batch = batches.get(document.instanceId) ?? {
      inboxItemIds: new Set<string>(),
      resultIndexes: new Set<number>(),
    };
    batch.inboxItemIds.add(document.inboxItemId);
    batch.resultIndexes.add(document.resultIndex);
    batches.set(document.instanceId, batch);
  }

  return Array.from(batches, ([instanceId, batch]) => ({
    instanceId,
    inboxItemIds: Array.from(batch.inboxItemIds),
    resultIndexes: Array.from(batch.resultIndexes),
  }));
}
