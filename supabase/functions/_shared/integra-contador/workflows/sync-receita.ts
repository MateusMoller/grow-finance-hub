import { assertSafeJob } from "../core/queue.ts";
export function buildFiscalSyncMessage(run:{id:string;organizationId:string;clientId:string;correlationId:string}) {
  return assertSafeJob({jobId:run.id,organizationId:run.organizationId,clientId:run.clientId,capabilityKey:"caixa_postal.new_message_indicator",correlationId:run.correlationId});
}
export function isFreshFiscalCache(validUntil:string, now=Date.now()){return new Date(validUntil).getTime()>now;}
