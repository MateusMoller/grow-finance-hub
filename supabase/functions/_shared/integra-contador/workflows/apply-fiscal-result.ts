export type FiscalRoutingInput={clientStatus?:string;actionRequired?:boolean;humanAction?:string|null;obligationMatch?:{instanceId:string;confidence:number}|null;issueFingerprint:string};
export type FiscalRoutingDecision={kind:"no_action"|"task"|"obligation"|"review";reason:string;integrationKey:string};
export function classifyFiscalResult(input:FiscalRoutingInput):FiscalRoutingDecision{
 const key=`integra-contador:${input.issueFingerprint}`;
 if(input.clientStatus&&input.clientStatus!=="Ativo")return{kind:"no_action",reason:"client_inactive_or_transferred",integrationKey:key};
 if(input.obligationMatch){if(input.obligationMatch.confidence>=0.95)return{kind:"obligation",reason:"conclusive_match",integrationKey:key};return{kind:"review",reason:"ambiguous_obligation_match",integrationKey:key};}
 if(input.actionRequired&&input.humanAction?.trim())return{kind:"task",reason:"concrete_human_action",integrationKey:key};
 return{kind:"no_action",reason:"automatic_or_technical_result",integrationKey:key};
}
