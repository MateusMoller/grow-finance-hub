import { supabase } from "@/integrations/supabase/client";
import { parseConnectionResponse } from "./schemas";
import type { ConfigureConnectionInput } from "./types";
import type { SimpleNationalClient, SimpleNationalDossier, SimpleNationalObligationKind } from "./types";
import type { DctfwebDossier } from "./types";
import type { MitDebt, MitDossier } from "./types";
import type { InstallmentAgreement, InstallmentEntry, InstallmentPayment } from "./types";

async function invokeRaw(body: FormData | Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("integra-contador-module", { body });
  if (error) {
    let code = (data as { error?: { code?: string } } | null)?.error?.code;
    const context = (error as { context?: unknown }).context;
    if (!code && context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: { code?: string } } | null;
      code = payload?.error?.code;
    }
    throw new Error(code || "operation_failed");
  }
  return data;
}

async function invokeInstallments<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("integra-contador-installments", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    const payload = context instanceof Response ? await context.clone().json().catch(() => null) as { error?: { code?: string } } | null : null;
    throw new Error(payload?.error?.code || "installment_operation_failed");
  }
  return data as T;
}

export const getConnectionStatus = async (organizationId: string) => parseConnectionResponse(await invokeRaw({ action: "connection_status", organizationId }));
export const testConnection = async (organizationId: string) => parseConnectionResponse(await invokeRaw({ action: "test_connection", organizationId }));
export function configureConnection(input: ConfigureConnectionInput) {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => form.set(key, value));
  form.set("action", "configure_connection");
  return invokeRaw(form).then(parseConnectionResponse);
}

export type ClientFiscalStatus = { indicator: null | { hasNewMessages:boolean; indicatorCode:string|null; sourceUpdatedAt:string|null; fetchedAt:string; stale:boolean }; run:null|{id:string;status:string;nextAttemptAt:string|null;errorCode:string|null;createdAt:string}; allowedActions:string[]; reviews?:Array<{id:string;status:string;reasonCode:string;recommendedAction:string;createdAt:string}> };
export async function getClientFiscalStatus(organizationId:string,clientId:string){const data=await invokeRaw({action:"get_client_fiscal_status",organizationId,clientId}) as {fiscalStatus:ClientFiscalStatus};return data.fiscalStatus;}
export async function syncClientFiscalStatus(organizationId:string,clientId:string,forceRefresh=false){return invokeRaw({action:"sync_client",organizationId,clientId,capability:"caixa_postal.new_message_indicator",forceRefresh}) as Promise<{syncRunId?:string;status:string;cacheHit:boolean}>;}
export type ClientCndCertificate={id:string;status:"valid"|"not_issued"|"processing"|"failed";provider_status:number|null;provider_message:string|null;certificate_type:number|null;control_code:string|null;taxpayer_number:string|null;issued_at:string|null;valid_until:string|null;storage_path:string|null;created_at:string};
export const getClientCnd=async(organizationId:string,clientId:string)=>invokeRaw({action:"get_client_cnd",organizationId,clientId}) as Promise<{certificate:ClientCndCertificate|null;configured:boolean}>;
export const issueClientCnd=async(organizationId:string,clientId:string)=>(await invokeRaw({action:"issue_client_cnd",organizationId,clientId}) as {certificate:ClientCndCertificate}).certificate;
export const getClientCndPdfUrl=async(organizationId:string,clientId:string,certificateId:string)=>(await invokeRaw({action:"get_client_cnd_pdf",organizationId,clientId,certificateId}) as {signedUrl:string}).signedUrl;
export type FiscalSyncRun={id:string;client_id:string|null;client_name:string|null;capability_key:string;reason:string;status:string;attempt_count:number;max_attempts:number;next_attempt_at:string|null;error_code:string|null;error_summary:string|null;parent_run_id:string|null;created_at:string;finished_at:string|null;eligible_reprocess:boolean};
export const listFiscalSyncRuns=async(organizationId:string,filters:Record<string,unknown>,cursor?:{createdAt:string;id:string})=>(await invokeRaw({action:"list_sync_runs",organizationId,filters,cursor,limit:25})as{runs:FiscalSyncRun[]}).runs;
export const getFiscalMonitoringSummary=async(organizationId:string)=>(await invokeRaw({action:"monitoring_summary",organizationId})as{summary:Record<string,unknown>}).summary;
export const reprocessFiscalSync=async(organizationId:string,syncRunId:string)=>invokeRaw({action:"reprocess_sync",organizationId,syncRunId});
export type FiscalClientRow={id:string;name:string;cnpj:string|null;status:string|null;sync_status:string|null;last_fiscal_update:string|null};
export const listFiscalClients=async(organizationId:string,offset:number)=>(await invokeRaw({action:"list_fiscal_clients",organizationId,offset,limit:25})as{clients:FiscalClientRow[]}).clients;

export const listSimpleNationalDossiers = async (organizationId: string) =>
  (await invokeRaw({ action: "list_simples_dossiers", organizationId, limit: 100 }) as { dossiers: SimpleNationalDossier[] }).dossiers;
export const listSimpleNationalClients = async (organizationId: string) =>
  (await invokeRaw({ action: "list_simples_clients", organizationId }) as { clients: SimpleNationalClient[] }).clients;
export type TaskSimpleNationalContext = {
  eligible: boolean;
  reason: string | null;
  dossier: SimpleNationalDossier | null;
  taskContext?: { taskId: string; instanceId: string; templateName: string | null };
};
export const getTaskSimpleNationalContext = async (organizationId: string, taskId: string) =>
  await invokeRaw({ action: "get_task_simples_context", organizationId, taskId }) as TaskSimpleNationalContext;
export const createSimpleNationalDossier = (organizationId: string, input: { clientId: string; kind: SimpleNationalObligationKind; competenceKey: string; obligationInstanceId?: string | null }) =>
  invokeRaw({ action: "create_simples_dossier", organizationId, ...input }) as Promise<{ dossierId: string }>;
export const saveSimpleNationalDossier = (organizationId: string, dossierId: string, inputData: Record<string, unknown>, sourceManifest: Array<{ type: string; reference: string }>) =>
  invokeRaw({ action: "save_simples_dossier", organizationId, dossierId, inputData, sourceManifest });
export const approveSimpleNationalDossier = (organizationId: string, dossierId: string, expectedVersion: number) =>
  invokeRaw({ action: "approve_simples_dossier", organizationId, dossierId, expectedVersion });
export const requestSimpleNationalTransmission = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "request_simples_transmission", organizationId, dossierId });
export const previewPgdasd = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "preview_pgdasd", organizationId, dossierId });
export const syncPgdasdPreviousCompetence = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "sync_pgdasd_previous_competence", organizationId, dossierId }) as Promise<{
    dossier: SimpleNationalDossier;
    previousCompetence: string;
    grossRevenue: number;
    payrollLinked: boolean;
  }>;
export const transmitPgdasd = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "transmit_pgdasd", organizationId, dossierId, confirmation: "TRANSMITIR" });
export const generatePgdasdDas = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "generate_pgdasd_das", organizationId, dossierId });
export const getPgdasdArtifactUrl = async (organizationId: string, dossierId: string, artifact: "declaration" | "receipt" | "das") =>
  (await invokeRaw({ action: "get_pgdasd_artifact", organizationId, dossierId, artifact }) as { signedUrl: string }).signedUrl;
export const syncDefisDeclarations = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "sync_defis_declarations", organizationId, dossierId });
export const syncDefisAnnualValues = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "sync_defis_annual_values", organizationId, dossierId }) as Promise<{
    dossier: SimpleNationalDossier;
    monthsComplete: number;
    annualRevenue: number;
  }>;
export const transmitDefis = (organizationId: string, dossierId: string) =>
  invokeRaw({ action: "transmit_defis", organizationId, dossierId, confirmation: "TRANSMITIR DEFIS" });
export const getDefisArtifactUrl = async (organizationId: string, dossierId: string, artifact: "declaration" | "receipt") =>
  (await invokeRaw({ action: "get_defis_artifact", organizationId, dossierId, artifact }) as { signedUrl: string }).signedUrl;
export type TaskDctfwebContext={eligible:boolean;reason:string|null;dossier:DctfwebDossier|null;taskContext?:{taskId:string;instanceId:string;templateName:string|null}};
export const getTaskDctfwebContext=(organizationId:string,taskId:string)=>invokeRaw({action:"get_task_dctfweb_context",organizationId,taskId}) as Promise<TaskDctfwebContext>;
export type TaskDarfInssContext={eligible:boolean;reason:string|null;targetInstanceId?:string;dossier:DctfwebDossier|null};
export const getTaskDarfInssContext=(organizationId:string,taskId:string)=>invokeRaw({action:"get_task_darf_inss_context",organizationId,taskId}) as Promise<TaskDarfInssContext>;
export const consultDctfwebArtifact=(organizationId:string,dossierId:string,artifact:"xml"|"receipt"|"report",receiptNumber?:string)=>invokeRaw({action:`consult_dctfweb_${artifact}`,organizationId,dossierId,receiptNumber});
export const generateDctfwebDarf=(organizationId:string,dossierId:string,mode:"transmitted"|"in_progress",receiptNumber?:string,targetObligationInstanceId?:string,taskId?:string)=>invokeRaw({action:"generate_dctfweb_darf",organizationId,dossierId,mode,receiptNumber,targetObligationInstanceId,taskId});
export const approveDctfweb=(organizationId:string,dossierId:string,expectedVersion:number)=>invokeRaw({action:"approve_dctfweb",organizationId,dossierId,expectedVersion});
export const transmitDctfweb=(organizationId:string,dossierId:string,signedXmlBase64:string)=>invokeRaw({action:"transmit_dctfweb",organizationId,dossierId,signedXmlBase64,confirmation:"TRANSMITIR DCTFWEB"});
export const getDctfwebArtifactUrl=async(organizationId:string,dossierId:string,artifact:"xml"|"receipt"|"report"|"darf")=>(await invokeRaw({action:"get_dctfweb_artifact",organizationId,dossierId,artifact}) as {signedUrl:string}).signedUrl;

export const getTaskMitContext=(organizationId:string,taskId:string)=>invokeRaw({action:"get_task_mit_context",organizationId,taskId}) as Promise<{eligible:boolean;reason:string|null;dossier:MitDossier|null;debts:MitDebt[]}>;
export const saveMitDebts=(organizationId:string,dossierId:string,debts:MitDebt[])=>invokeRaw({action:"save_mit_debts",organizationId,dossierId,debts:debts.map((debt)=>({revenueCode:debt.revenue_code,description:debt.description,debitAmount:debt.debit_amount,dueDate:debt.due_date,establishmentCnpj:debt.establishment_cnpj,source:debt.source||"manual"}))});
export const validateMit=(organizationId:string,dossierId:string)=>invokeRaw({action:"validate_mit",organizationId,dossierId});
export const submitMit=(organizationId:string,dossierId:string,taskId:string)=>invokeRaw({action:"submit_mit",organizationId,dossierId,taskId,confirmation:"ENCERRAR E TRANSMITIR MIT"});
export const verifyMit=(organizationId:string,dossierId:string,taskId:string)=>invokeRaw({action:"verify_mit",organizationId,dossierId,taskId});

export const listInstallments = async (organizationId:string, filters:Record<string,unknown> = {}) => (await invokeInstallments<{agreements:InstallmentAgreement[]}>({action:"list_installments",organizationId,...filters})).agreements;
export type InstallmentClient = { id:string; name:string; cnpj:string|null; regime:string|null; status:string|null };
export const listInstallmentClients = async (organizationId:string) => (await invokeInstallments<{clients:InstallmentClient[]}>({action:"list_installment_clients",organizationId})).clients;
export const getInstallmentDetail = async (organizationId:string, agreementId:string) => (await invokeInstallments<{agreement:InstallmentAgreement & {fiscal_installment_entries:Array<InstallmentEntry & {fiscal_installment_payments:InstallmentPayment[]}>}}>({action:"get_installment_detail",organizationId,agreementId})).agreement;
export const syncInstallmentsClient = (organizationId:string, clientId:string) => invokeInstallments<{results:Array<{modality:string;agreements?:number;error?:string}>}>({action:"sync_installments_client",organizationId,clientId});
export const listPrintableInstallments = async (organizationId:string) => (await invokeInstallments<{installments:InstallmentEntry[]}>({action:"list_printable_installments",organizationId})).installments;
export const issueInstallmentDas = (organizationId:string, entryId:string) => invokeInstallments<{entryId:string;documentId:string;taskId:string;dueDate:string|null;duplicate:boolean}>({action:"issue_installment_das",organizationId,entryId,confirmation:"EMITIR DAS PARCELAMENTO"});
export const syncInstallmentPayment = (organizationId:string, entryId:string) => invokeInstallments<{payment:Record<string,unknown>;paid:boolean}>({action:"sync_installment_payment",organizationId,entryId});
export const getInstallmentDocumentUrl = async (organizationId:string, documentId:string) => (await invokeInstallments<{signedUrl:string}>({action:"get_installment_document_url",organizationId,documentId})).signedUrl;
