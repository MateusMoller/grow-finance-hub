import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ConnectionInputError, CONNECTION_ENVIRONMENTS, requiredFormText, sanitizeConnection, validateCertificate } from "../_shared/integra-contador/connection.ts";
import { consultPreviousPgdasTrial, generateDasTrial, previewPgdasTrial, transmitPgdasTrial, type PgdasDeclarationInput, type PgdasTaxValue } from "../_shared/integra-contador/domains/pgdasd/client.ts";
import { previousCompetence } from "../_shared/integra-contador/domains/pgdasd/prior-period.ts";
import { listDefisDeclarationsTrial, transmitDefisTrial, type DefisDeclarationInput } from "../_shared/integra-contador/domains/defis/client.ts";
import { consultDctfwebReceiptTrial, consultDctfwebReportTrial, consultDctfwebXmlTrial, generateDctfwebDarfTrial, transmitDctfwebTrial } from "../_shared/integra-contador/domains/dctfweb/client.ts";
import type { DctfwebCategory, DctfwebInput } from "../_shared/integra-contador/domains/dctfweb/contracts.ts";
import { consultMitDeclaration, submitMitDeclaration, type MitDebtInput } from "../_shared/integra-contador/domains/mit/client.ts";
import { issueFederalCnd } from "../_shared/cnd/client.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const errorResponse = (code: string, status: number) => response({ error: { code } }, status);

async function publishDctfwebArtifactToObligation(
  admin: ReturnType<typeof createClient>,
  input: {
    organizationId: string;
    instanceId: string;
    actorId: string;
    artifactType: "receipt" | "complete_report" | "darf";
    storagePath: string;
    byteSize: number;
    receiptNumber: string | null;
    competenceKey: string;
  },
) {
  const names = {
    receipt: `Recibo_DCTFWeb_${input.competenceKey}.pdf`,
    complete_report: `Declaracao_DCTFWeb_${input.competenceKey}.pdf`,
    darf: `DARF_INSS_${input.competenceKey}.pdf`,
  } as const;
  const { error: fileError } = await admin.from("obligation_instance_files").upsert({
    organization_id: input.organizationId,
    instance_id: input.instanceId,
    inbox_item_id: null,
    file_name: names[input.artifactType],
    storage_bucket: "obligation-files",
    storage_path: input.storagePath,
    content_type: "application/pdf",
    file_size: input.byteSize,
    triage_status: "accepted",
    source: "integra_contador",
    source_kind: "api",
    protocol_number: input.receiptNumber,
    publication_status: "published",
    uploaded_by: input.actorId,
    identification_confidence: 1,
  }, { onConflict: "storage_bucket,storage_path" });
  if (fileError) throw fileError;

  if (input.artifactType === "darf" || input.artifactType === "receipt") {
    const now = new Date().toISOString();
    const { error: instanceError } = await admin.from("obligation_instances").update({
      status: "concluida",
      completed_at: now,
      last_status_at: now,
      processed_automatically: true,
      protocol: input.receiptNumber,
    }).eq("id", input.instanceId).eq("organization_id", input.organizationId);
    if (instanceError) throw instanceError;
  }
}

async function publishDefisDocumentsToObligation(
  admin: ReturnType<typeof createClient>,
  input: {
    organizationId: string;
    instanceId: string;
    actorId: string;
    year: string;
    declarationId: string;
    declarationPath: string;
    declarationSize: number;
    receiptPath: string;
    receiptSize: number;
  },
) {
  const files = [
    { file_name: `Declaracao_DEFIS_${input.year}.pdf`, storage_path: input.declarationPath, file_size: input.declarationSize },
    { file_name: `Recibo_DEFIS_${input.year}.pdf`, storage_path: input.receiptPath, file_size: input.receiptSize },
  ].map((file) => ({
    ...file,
    organization_id: input.organizationId,
    instance_id: input.instanceId,
    inbox_item_id: null,
    storage_bucket: "obligation-files",
    content_type: "application/pdf",
    triage_status: "accepted",
    source: "integra_contador",
    source_kind: "api",
    protocol_number: input.declarationId,
    publication_status: "published",
    uploaded_by: input.actorId,
    identification_confidence: 1,
  }));
  const { error: filesError } = await admin.from("obligation_instance_files")
    .upsert(files, { onConflict: "storage_bucket,storage_path" });
  if (filesError) throw filesError;

  const now = new Date().toISOString();
  const { error: instanceError } = await admin.from("obligation_instances").update({
    status: "concluida",
    completed_at: now,
    ready_for_delivery_at: now,
    last_status_at: now,
    processed_automatically: true,
    protocol: input.declarationId,
    protocol_issued_at: now,
  }).eq("id", input.instanceId).eq("organization_id", input.organizationId);
  if (instanceError) throw instanceError;
}

function pgdasInput(dossier: Record<string, unknown>): PgdasDeclarationInput {
  const input = (dossier.input_data || {}) as Record<string, unknown>;
  const activities = Array.isArray(input.revenue_by_activity) ? input.revenue_by_activity as Array<Record<string, unknown>> : [];
  const firstActivity = activities[0] || {};
  const preview = (dossier.preview_result || {}) as Record<string, unknown>;
  return {
    cnpj: String(input.cnpj || ""),
    competence: String(dossier.competence_key || ""),
    revenueRegime: input.revenue_regime === "caixa" ? "caixa" : "competencia",
    domesticRevenue: Number(input.domestic_revenue ?? input.revenue_total ?? firstActivity.revenue ?? 0),
    foreignRevenue: Number(input.foreign_revenue ?? 0),
    activityId: Number(firstActivity.activity_id || input.activity_id || 1),
    priorRevenues: Array.isArray(input.prior_revenues) ? input.prior_revenues as PgdasDeclarationInput["priorRevenues"] : [],
    payrollHistory: Array.isArray(input.payroll_history) ? input.payroll_history as PgdasDeclarationInput["payrollHistory"] : [],
    taxValues: Array.isArray(preview.taxValues) ? preview.taxValues as PgdasTaxValue[] : [],
  };
}

function defisInput(dossier: Record<string, unknown>): DefisDeclarationInput {
  const input = (dossier.input_data || {}) as Record<string, unknown>;
  return {
    cnpj: String(input.cnpj || ""),
    year: Number(dossier.competence_key || 0),
    inactivity: input.inactivity == null || input.inactivity === "" ? null : Number(input.inactivity) as 0 | 1 | 2,
    specialSituation: input.special_situation && typeof input.special_situation === "object" ? input.special_situation as DefisDeclarationInput["specialSituation"] : null,
    capitalGain: Number(input.capital_gain || 0),
    employeesAtStart: Number(input.employees_at_start || 0),
    employeesAtEnd: Number(input.employees_at_end || 0),
    accountingProfit: input.accounting_profit == null || input.accounting_profit === "" ? null : Number(input.accounting_profit),
    directExportRevenue: Number(input.direct_export_revenue || 0),
    treasuryQuotaParticipation: input.treasury_quota_participation == null || input.treasury_quota_participation === "" ? null : Number(input.treasury_quota_participation),
    variableIncomeGain: Number(input.variable_income_gain || 0),
    partners: Array.isArray(input.partners) ? input.partners as DefisDeclarationInput["partners"] : [],
    establishments: Array.isArray(input.establishments) ? input.establishments as DefisDeclarationInput["establishments"] : [],
  };
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseSerproTimestamp(value: string | null) {
  if (!value || !/^\d{14}$/.test(value)) return new Date().toISOString();
  return `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:${value.slice(10,12)}:${value.slice(12,14)}-03:00`;
}

function parseSerproDate(value: string | null) {
  return value && /^\d{8}$/.test(value) ? `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}` : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return errorResponse("invalid_request", 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !anon) return errorResponse("operation_failed", 500);
  if (!authorization?.toLowerCase().startsWith("bearer ")) return errorResponse("unauthorized", 401);

  const db = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return errorResponse("unauthorized", 401);

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("action") !== "configure_connection") throw new ConnectionInputError("invalid_request");
      const organizationId = requiredFormText(form, "organizationId", 36);
      const environment = requiredFormText(form, "environment", 20);
      const contractorTaxId = requiredFormText(form, "contractorTaxId", 14).replace(/\D/g, "");
      const consumerKey = requiredFormText(form, "consumerKey");
      const consumerSecret = requiredFormText(form, "consumerSecret");
      const certificatePassword = requiredFormText(form, "certificatePassword");
      const certificate = form.get("certificate");
      if (!CONNECTION_ENVIRONMENTS.includes(environment as never) || contractorTaxId.length !== 14 || !(certificate instanceof File)) {
        throw new ConnectionInputError("invalid_request");
      }
      validateCertificate(certificate);
      const bytes = new Uint8Array(await certificate.arrayBuffer());
      try {
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const fingerprint = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const { error } = await db.rpc("configure_integra_contador_connection", {
          _organization_id: organizationId, _environment: environment, _contractor_tax_id: contractorTaxId,
          _consumer_key: consumerKey, _consumer_secret: consumerSecret, _certificate_base64: btoa(binary),
          _certificate_password: certificatePassword, _certificate_filename: certificate.name, _certificate_fingerprint: fingerprint,
        });
        if (error) throw error;
      } finally { bytes.fill(0); }
      const { data, error } = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
      if (error) throw error;
      return response({ connection: sanitizeConnection(data?.[0] || null) });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "");
    const organizationId = String(body.organizationId || "");
    if (!organizationId) throw new ConnectionInputError("invalid_request");
    if (action === "connection_status") {
      const { data, error } = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
      if (error) throw error;
      return response({ connection: sanitizeConnection(data?.[0] || null) });
    }
    if (action === "test_connection") {
      const statusResult = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
      let data = statusResult.data;
      const error = statusResult.error;
      if (error) throw error;
      const provider = Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake";
      if (!data?.[0] && provider === "trial") {
        const activation = await db.rpc("activate_integra_contador_trial", { _organization_id: organizationId });
        if (activation.error) throw activation.error;
        const refreshed = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
      }
      const connection = data?.[0];
      if (!connection) return errorResponse("connection_not_ready", 409);
      const status = provider === "fake" || provider === "trial" ? "active" : "requires_action";
      const errorCode = status === "active" ? null : "EXTERNAL_CONTRACT_UNVERIFIED";
      const { error: updateError } = await db.rpc("record_integra_contador_connection_validation", {
        _organization_id: organizationId, _connection_id: connection.id, _status: status, _error_code: errorCode,
      });
      if (updateError) throw updateError;
      const { data: refreshed } = await db.rpc("get_integra_contador_connection_status", { _organization_id: organizationId });
      return response({ connection: sanitizeConnection(refreshed?.[0] || null) });
    }
    if (action === "sync_client") {
      const clientId = String(body.clientId || "");
      if (!clientId || body.capability !== "caixa_postal.new_message_indicator") throw new ConnectionInputError("invalid_request");
      const { data, error } = await db.rpc("enqueue_caixa_postal_indicator_sync", {
        _organization_id: organizationId, _client_id: clientId, _force_refresh: body.forceRefresh === true,
      });
      if (error) throw error;
      const queued = data as { syncRunId?: string; cacheHit?: boolean } | null;
      if (queued?.syncRunId && !queued.cacheHit) {
        const workerToken = Deno.env.get("INTEGRA_CONTADOR_INTERNAL_WORKER_SECRET");
        const workerRequest = fetch(`${url}/functions/v1/integra-contador-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authorization, ...(workerToken ? { "x-worker-token": workerToken } : {}) },
          body: JSON.stringify({ runId: queued.syncRunId }),
        }).catch(() => undefined);
        const edgeRuntime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime;
        edgeRuntime?.waitUntil(workerRequest);
      }
      return response({ ok: true, ...data });
    }
    if (action === "get_client_fiscal_status") {
      const clientId = String(body.clientId || "");
      if (!clientId) throw new ConnectionInputError("invalid_request");
      const [statusResult, reviewsResult] = await Promise.all([
        db.rpc("get_client_fiscal_status", { _organization_id: organizationId, _client_id: clientId }),
        db.rpc("get_client_fiscal_reviews", { _organization_id: organizationId, _client_id: clientId }),
      ]);
      if (statusResult.error) throw statusResult.error;
      if (reviewsResult.error) throw reviewsResult.error;
      return response({ ok: true, fiscalStatus: { ...(statusResult.data as Record<string, unknown>), reviews: reviewsResult.data || [] } });
    }
    if (action === "get_client_cnd") {
      const clientId=String(body.clientId||""); if(!clientId) throw new ConnectionInputError("invalid_request");
      const clientResult=await db.from("clients").select("id").eq("id",clientId).eq("organization_id",organizationId).maybeSingle();
      if(clientResult.error)throw clientResult.error; if(!clientResult.data)return errorResponse("client_not_available",404);
      const certificateResult=await db.from("client_cnd_certificates").select("id,status,provider_status,provider_message,certificate_type,control_code,taxpayer_number,issued_at,valid_until,storage_path,created_at").eq("organization_id",organizationId).eq("client_id",clientId).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(certificateResult.error)throw certificateResult.error;
      return response({ok:true,certificate:certificateResult.data||null,configured:Boolean(Deno.env.get("CND_SERPRO_CLIENT_ID")&&Deno.env.get("CND_SERPRO_CLIENT_SECRET"))});
    }
    if (action === "issue_client_cnd") {
      const clientId=String(body.clientId||""); if(!clientId) throw new ConnectionInputError("invalid_request");
      const clientResult=await db.from("clients").select("id,cnpj").eq("id",clientId).eq("organization_id",organizationId).maybeSingle();
      if(clientResult.error)throw clientResult.error; if(!clientResult.data)return errorResponse("client_not_available",404);
      const cnpj=String(clientResult.data.cnpj||"").replace(/\D/g,""); if(cnpj.length!==14)return errorResponse("CND_INVALID_CNPJ",409);
      const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!serviceKey)return errorResponse("operation_failed",500);
      const admin=createClient(url,serviceKey);
      const result=await issueFederalCnd(cnpj);
      const providerCertificate=(result.raw.Certidao||result.raw.certidao) as Record<string,unknown>|undefined;
      const safePayload={...Object.fromEntries(Object.entries(result.raw).filter(([key])=>key.toLowerCase()!=="certidao")),...(providerCertificate?{Certidao:Object.fromEntries(Object.entries(providerCertificate).filter(([key])=>key.toLowerCase()!=="documentopdf"))}:{})};
      if(!result.certificate){
        const status=result.status===7?"processing":result.status===3||result.status===4?"not_issued":"failed";
        const inserted=await admin.from("client_cnd_certificates").insert({organization_id:organizationId,client_id:clientId,status,provider_status:result.status,provider_message:result.message,provider_payload:safePayload,created_by:auth.user.id}).select("id,status,provider_status,provider_message,certificate_type,control_code,taxpayer_number,issued_at,valid_until,storage_path,created_at").single();
        if(inserted.error)throw inserted.error;
        return response({ok:true,certificate:inserted.data});
      }
      let pdfBytes:Uint8Array;
      try{pdfBytes=decodeBase64(result.certificate.pdfBase64);}catch{throw new Error("CND_PDF_INVALID");}
      if(pdfBytes.length===0||pdfBytes.length>10*1024*1024)throw new Error("CND_PDF_INVALID_SIZE");
      const signature=new TextDecoder().decode(pdfBytes.slice(0,5)); if(signature!=="%PDF-")throw new Error("CND_PDF_INVALID");
      const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",pdfBytes.slice().buffer))].map((value)=>value.toString(16).padStart(2,"0")).join("");
      const path=`${organizationId}/${clientId}/cnd/cnd-${result.certificate.controlCode.replace(/[^a-zA-Z0-9]/g,"")}-${digest.slice(0,12)}.pdf`;
      const upload=await admin.storage.from("client-files").upload(path,pdfBytes,{contentType:"application/pdf",upsert:false});
      if(upload.error&&!upload.error.message.toLowerCase().includes("exist"))throw upload.error;
      const existing=await admin.from("client_cnd_certificates").select("id").eq("organization_id",organizationId).eq("client_id",clientId).eq("control_code",result.certificate.controlCode).maybeSingle();
      if(existing.error)throw existing.error;
      const values={status:"valid",provider_status:result.status,provider_message:result.message,certificate_type:result.certificate.certificateType,control_code:result.certificate.controlCode,taxpayer_number:result.certificate.taxpayerNumber,issued_at:result.certificate.issuedAt,valid_until:result.certificate.validUntil,storage_bucket:"client-files",storage_path:path,content_sha256:digest,provider_payload:safePayload,updated_at:new Date().toISOString()};
      const saved=existing.data?await admin.from("client_cnd_certificates").update(values).eq("id",existing.data.id).select("id,status,provider_status,provider_message,certificate_type,control_code,taxpayer_number,issued_at,valid_until,storage_path,created_at").single():await admin.from("client_cnd_certificates").insert({...values,organization_id:organizationId,client_id:clientId,created_by:auth.user.id}).select("id,status,provider_status,provider_message,certificate_type,control_code,taxpayer_number,issued_at,valid_until,storage_path,created_at").single();
      if(saved.error)throw saved.error;
      return response({ok:true,certificate:saved.data});
    }
    if (action === "get_client_cnd_pdf") {
      const clientId=String(body.clientId||""); const certificateId=String(body.certificateId||""); if(!clientId||!certificateId)throw new ConnectionInputError("invalid_request");
      const certificateResult=await db.from("client_cnd_certificates").select("storage_bucket,storage_path").eq("id",certificateId).eq("client_id",clientId).eq("organization_id",organizationId).maybeSingle();
      if(certificateResult.error)throw certificateResult.error; if(!certificateResult.data?.storage_path)return errorResponse("cnd_pdf_not_available",404);
      const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!serviceKey)return errorResponse("operation_failed",500);
      const admin=createClient(url,serviceKey); const signed=await admin.storage.from(certificateResult.data.storage_bucket||"client-files").createSignedUrl(certificateResult.data.storage_path,120);
      if(signed.error)throw signed.error; return response({ok:true,signedUrl:signed.data.signedUrl});
    }
    if (action === "monitoring_summary") {
      const { data, error } = await db.rpc("get_fiscal_monitoring_summary", { _organization_id: organizationId });
      if (error) throw error; return response({ ok: true, summary: data });
    }
    if (action === "list_sync_runs") {
      const filters = (body.filters || {}) as Record<string, unknown>; const cursor = (body.cursor || {}) as Record<string, unknown>;
      const { data, error } = await db.rpc("list_fiscal_sync_runs", { _organization_id: organizationId, _client_id: filters.clientId || null, _capability: filters.capability || null, _statuses: filters.status || null, _cursor_created_at: cursor.createdAt || null, _cursor_id: cursor.id || null, _limit: Math.min(Number(body.limit || 50), 100) });
      if (error) throw error; return response({ ok: true, runs: data });
    }
    if (action === "list_fiscal_clients") {
      const { data, error } = await db.rpc("list_fiscal_clients_status", { _organization_id: organizationId, _offset: Math.max(Number(body.offset || 0), 0), _limit: Math.min(Number(body.limit || 25), 100) });
      if (error) throw error; return response({ ok: true, clients: data });
    }
    if (action === "reprocess_sync") {
      const runId = String(body.syncRunId || ""); if (!runId) throw new ConnectionInputError("invalid_request");
      const { data, error } = await db.rpc("reprocess_fiscal_sync_run", { _organization_id: organizationId, _run_id: runId });
      if (error) { if (error.message.includes("reprocess_not_allowed")) return errorResponse("reprocess_not_allowed", 409); throw error; }
      return response({ ok: true, syncRunId: data });
    }
    if (action === "list_simples_dossiers") {
      const { data, error } = await db.rpc("list_simple_national_dossiers", {
        _organization_id: organizationId,
        _limit: Math.min(Math.max(Number(body.limit || 50), 1), 100),
      });
      if (error) throw error;
      return response({ ok: true, dossiers: data || [] });
    }
    if (action === "list_simples_clients") {
      const { data, error } = await db.rpc("list_simple_national_clients", { _organization_id: organizationId });
      if (error) throw error;
      return response({ ok: true, clients: data || [] });
    }
    if (action === "get_task_darf_inss_context") {
      const taskId=String(body.taskId||""); if(!taskId) throw new ConnectionInputError("invalid_request");
      const taskResult=await db.from("kanban_tasks").select("id,integration_source,integration_payload").eq("id",taskId).eq("organization_id",organizationId).maybeSingle();
      if(taskResult.error) throw taskResult.error;
      const task=taskResult.data;
      if(!task||task.integration_source!=="grow_obligation_task") return response({ok:true,eligible:false,reason:"not_obligation_task",dossier:null});
      const payload=task.integration_payload&&typeof task.integration_payload==="object"?task.integration_payload as Record<string,unknown>:{};
      const instanceId=String(payload.instance_id||""); if(!instanceId) return response({ok:true,eligible:false,reason:"missing_obligation_instance",dossier:null});
      const instanceResult=await db.from("obligation_instances").select("id,client_id,template_id,competence_key").eq("id",instanceId).eq("organization_id",organizationId).maybeSingle();
      if(instanceResult.error) throw instanceResult.error; if(!instanceResult.data) return response({ok:true,eligible:false,reason:"obligation_not_available",dossier:null});
      const templateResult=await db.from("obligation_templates").select("code,name").eq("id",instanceResult.data.template_id).eq("organization_id",organizationId).maybeSingle();
      if(templateResult.error) throw templateResult.error;
      const identity=`${templateResult.data?.code||""} ${templateResult.data?.name||""}`.toLowerCase().replace(/[^a-z0-9]/g,"");
      if(!identity.includes("darfinss")) return response({ok:true,eligible:false,reason:"unsupported_obligation",dossier:null});
      const competenceKey=String(instanceResult.data.competence_key||"").replace(/\D/g,"").slice(0,6);
      if(!/^\d{6}$/.test(competenceKey)) return response({ok:true,eligible:true,reason:"invalid_obligation_competence",targetInstanceId:instanceId,dossier:null});
      const dossierResult=await db.from("dctfweb_dossiers").select("*").eq("organization_id",organizationId).eq("client_id",instanceResult.data.client_id).eq("competence_key",competenceKey).order("updated_at",{ascending:false}).limit(1).maybeSingle();
      if(dossierResult.error) throw dossierResult.error;
      if(!dossierResult.data) return response({ok:true,eligible:true,reason:"dctfweb_declaration_required",targetInstanceId:instanceId,dossier:null});
      if(!["transmitted","completed"].includes(dossierResult.data.status)) return response({ok:true,eligible:true,reason:"dctfweb_transmission_required",targetInstanceId:instanceId,dossier:dossierResult.data});
      return response({ok:true,eligible:true,reason:null,targetInstanceId:instanceId,dossier:dossierResult.data});
    }
    if (action === "get_task_mit_context") {
      const taskId=String(body.taskId||""); if(!taskId) throw new ConnectionInputError("invalid_request");
      const taskResult=await db.from("kanban_tasks").select("id,integration_source,integration_payload").eq("id",taskId).eq("organization_id",organizationId).maybeSingle();
      if(taskResult.error) throw taskResult.error;
      const task=taskResult.data;
      if(!task||task.integration_source!=="grow_obligation_task") return response({ok:true,eligible:false,reason:"not_obligation_task",dossier:null});
      const payload=task.integration_payload&&typeof task.integration_payload==="object"?task.integration_payload as Record<string,unknown>:{};
      const instanceId=String(payload.instance_id||"");
      if(!instanceId) return response({ok:true,eligible:false,reason:"missing_obligation_instance",dossier:null});
      const instanceResult=await db.from("obligation_instances").select("id,client_id,template_id,competence_key").eq("id",instanceId).eq("organization_id",organizationId).maybeSingle();
      if(instanceResult.error) throw instanceResult.error;
      if(!instanceResult.data) return response({ok:true,eligible:false,reason:"obligation_not_available",dossier:null});
      const [templateResult,clientResult]=await Promise.all([
        db.from("obligation_templates").select("code,name").eq("id",instanceResult.data.template_id).eq("organization_id",organizationId).maybeSingle(),
        db.from("clients").select("name,cnpj").eq("id",instanceResult.data.client_id).eq("organization_id",organizationId).maybeSingle(),
      ]);
      if(templateResult.error) throw templateResult.error; if(clientResult.error) throw clientResult.error;
      if(templateResult.data?.code!=="mit") return response({ok:true,eligible:false,reason:"unsupported_obligation",dossier:null});
      const competenceKey=String(instanceResult.data.competence_key||"").replace(/\D/g,"").slice(0,6);
      if(!/^\d{6}$/.test(competenceKey)) return response({ok:true,eligible:false,reason:"invalid_obligation_competence",dossier:null});
      const prepared=await db.rpc("prepare_mit_dossier",{_organization_id:organizationId,_client_id:instanceResult.data.client_id,_instance_id:instanceId,_competence_key:competenceKey});
      if(prepared.error) throw prepared.error;
      const [dossierResult,debtsResult]=await Promise.all([
        db.from("mit_dossiers").select("*").eq("id",prepared.data).eq("organization_id",organizationId).single(),
        db.from("mit_debts").select("*").eq("dossier_id",prepared.data).eq("organization_id",organizationId).order("created_at"),
      ]);
      if(dossierResult.error) throw dossierResult.error; if(debtsResult.error) throw debtsResult.error;
      return response({ok:true,eligible:true,reason:null,dossier:{...dossierResult.data,client_name:clientResult.data?.name||"Cliente",client_cnpj:clientResult.data?.cnpj||null},debts:debtsResult.data||[]});
    }
    if (["save_mit_debts","validate_mit","submit_mit","verify_mit"].includes(action)) {
      const dossierId=String(body.dossierId||""); if(!dossierId) throw new ConnectionInputError("invalid_request");
      const dossierResult=await db.from("mit_dossiers").select("*").eq("id",dossierId).eq("organization_id",organizationId).maybeSingle();
      if(dossierResult.error) throw dossierResult.error; if(!dossierResult.data) return errorResponse("mit_dossier_not_available",404);
      const dossier=dossierResult.data as Record<string,unknown>;
      if(action==="save_mit_debts") {
        const debts=Array.isArray(body.debts)?body.debts:[];
        const saved=await db.rpc("replace_mit_debts",{_organization_id:organizationId,_dossier_id:dossierId,_debts:debts});
        if(saved.error) throw saved.error;
        return response({ok:true});
      }
      const debtsResult=await db.from("mit_debts").select("*").eq("dossier_id",dossierId).eq("organization_id",organizationId).order("created_at");
      if(debtsResult.error) throw debtsResult.error;
      const debtRows=debtsResult.data||[];
      if(action==="validate_mit") {
        if(debtRows.length===0) return errorResponse("mit_debts_required",409);
        const updated=await db.from("mit_dossiers").update({status:"validated",validated_version:dossier.data_version,validated_by:auth.user.id,validated_at:new Date().toISOString(),updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId).select("*").single();
        if(updated.error) throw updated.error;
        return response({ok:true,dossier:updated.data});
      }
      if(action==="submit_mit"&&(body.confirmation!=="ENCERRAR E TRANSMITIR MIT"||dossier.status!=="validated"||Number(dossier.validated_version)!==Number(dossier.data_version))) {
        return errorResponse("mit_not_validated",409);
      }
      if(action==="verify_mit"&&!dossier.protocol_number) return errorResponse("mit_protocol_required",409);
      const clientResult=await db.from("clients").select("cnpj").eq("id",String(dossier.client_id)).eq("organization_id",organizationId).single();
      if(clientResult.error) throw clientResult.error;
      const debts:MitDebtInput[]=debtRows.map((row)=>({revenueCode:String(row.revenue_code),description:String(row.description),debitAmount:Number(row.debit_amount),dueDate:row.due_date?String(row.due_date):null,establishmentCnpj:row.establishment_cnpj?String(row.establishment_cnpj):null}));
      const providerInput={cnpj:String(clientResult.data.cnpj||""),competence:String(dossier.competence_key),debts,protocolNumber:dossier.protocol_number?String(dossier.protocol_number):null};
      const tag=`mit-${dossierId.replace(/-/g,"").slice(0,20)}`;
      const idempotencyKey=`${dossierId}:${action}:v${Number(dossier.data_version)}:${dossier.protocol_number||"none"}`;
      const existing=await db.from("mit_operations").select("id,status").eq("organization_id",organizationId).eq("idempotency_key",idempotencyKey).maybeSingle();
      if(existing.error) throw existing.error;
      if(existing.data?.status==="completed") return response({ok:true,cacheHit:true});
      const operationPayload={organization_id:organizationId,dossier_id:dossierId,task_id:body.taskId?String(body.taskId):null,action,idempotency_key:idempotencyKey,status:"processing",request_tag:tag,error_code:null,finished_at:null,created_by:auth.user.id};
      const operation=existing.data?await db.from("mit_operations").update(operationPayload).eq("id",existing.data.id).select("id").single():await db.from("mit_operations").insert(operationPayload).select("id").single();
      if(operation.error) throw operation.error;
      const operationId=operation.data.id;
      try {
        if(action==="submit_mit") {
          await db.from("mit_dossiers").update({status:"submitting",updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId);
          const result=await submitMitDeclaration(providerInput,tag);
          const nextStatus=result.status==="transmitted"?"transmitted":result.status==="processing"?"processing":result.status==="rejected"?"requires_action":"transmission_unknown";
          const updated=await db.from("mit_dossiers").update({status:nextStatus,protocol_number:result.protocolNumber,receipt_number:result.receiptNumber,provider_state:result.raw,transmitted_at:result.status==="transmitted"?new Date().toISOString():null,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId);
          if(updated.error) throw updated.error;
          await db.from("mit_operations").update({status:result.status==="unknown"?"transmission_unknown":"completed",provider_code:result.status,metadata:result.raw,finished_at:new Date().toISOString()}).eq("id",operationId);
          return response({ok:true,result});
        }
        const result=await consultMitDeclaration(providerInput,tag);
        if(result.status==="transmitted"&&result.receiptNumber) {
          const now=new Date().toISOString();
          const adminKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!adminKey) throw new Error("operation_failed");
          const admin=createClient(url,adminKey);
          const [dossierUpdate,instanceUpdate]=await Promise.all([
            db.from("mit_dossiers").update({status:"verified",receipt_number:result.receiptNumber,provider_state:result.raw,verified_at:now,updated_by:auth.user.id,updated_at:now}).eq("id",dossierId).eq("organization_id",organizationId),
            admin.from("obligation_instances").update({status:"concluida",completed_at:now,last_status_at:now,processed_automatically:true,protocol:result.receiptNumber}).eq("id",String(dossier.obligation_instance_id)).eq("organization_id",organizationId),
          ]);
          if(dossierUpdate.error) throw dossierUpdate.error; if(instanceUpdate.error) throw instanceUpdate.error;
        } else {
          const nextStatus=result.status==="processing"?"processing":result.status==="rejected"?"requires_action":"transmission_unknown";
          await db.from("mit_dossiers").update({status:nextStatus,provider_state:result.raw,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId);
        }
        await db.from("mit_operations").update({status:"completed",provider_code:result.status,metadata:result.raw,finished_at:new Date().toISOString()}).eq("id",operationId);
        return response({ok:true,result});
      } catch(error) {
        const message=error instanceof Error?error.message:"mit_operation_failed";
        const ambiguous=/SERPRO_HTTP_(500|502|503|504)|network|fetch/i.test(message);
        await db.from("mit_dossiers").update({status:ambiguous?"transmission_unknown":"requires_action",updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId);
        await db.from("mit_operations").update({status:ambiguous?"transmission_unknown":"failed",error_code:message.slice(0,120),finished_at:new Date().toISOString()}).eq("id",operationId);
        throw error;
      }
    }
    if (action === "get_task_dctfweb_context") {
      const taskId = String(body.taskId || "");
      if (!taskId) throw new ConnectionInputError("invalid_request");
      const taskResult = await db.from("kanban_tasks").select("id,integration_source,integration_payload").eq("id",taskId).eq("organization_id",organizationId).maybeSingle();
      if (taskResult.error) throw taskResult.error;
      const task = taskResult.data;
      if (!task || task.integration_source !== "grow_obligation_task") return response({ ok:true,eligible:false,reason:"not_obligation_task",dossier:null });
      const payload = task.integration_payload && typeof task.integration_payload === "object" ? task.integration_payload as Record<string,unknown> : {};
      const instanceId = String(payload.instance_id || "");
      if (!instanceId) return response({ ok:true,eligible:false,reason:"missing_obligation_instance",dossier:null });
      const instanceResult = await db.from("obligation_instances").select("id,client_id,template_id,competence_key").eq("id",instanceId).eq("organization_id",organizationId).maybeSingle();
      if (instanceResult.error) throw instanceResult.error;
      if (!instanceResult.data) return response({ok:true,eligible:false,reason:"obligation_not_available",dossier:null});
      const [templateResult,clientResult] = await Promise.all([
        db.from("obligation_templates").select("name,code").eq("id",instanceResult.data.template_id).eq("organization_id",organizationId).maybeSingle(),
        db.from("clients").select("name,cnpj").eq("id",instanceResult.data.client_id).eq("organization_id",organizationId).maybeSingle(),
      ]);
      if (templateResult.error) throw templateResult.error; if (clientResult.error) throw clientResult.error;
      const identity = `${templateResult.data?.code || ""} ${templateResult.data?.name || ""}`.toLowerCase().replace(/[^a-z0-9]/g,"");
      if (!identity.includes("dctfweb")) return response({ok:true,eligible:false,reason:"unsupported_obligation",dossier:null});
      const competenceKey = String(instanceResult.data.competence_key || "").replace(/\D/g,"").slice(0,6);
      if (!/^\d{6}$/.test(competenceKey)) return response({ok:true,eligible:false,reason:"invalid_obligation_competence",dossier:null});
      const prepared = await db.rpc("prepare_dctfweb_dossier",{_organization_id:organizationId,_client_id:instanceResult.data.client_id,_instance_id:instanceId,_competence_key:competenceKey,_category:"GERAL_MENSAL"});
      if (prepared.error) throw prepared.error;
      const dossierResult = await db.from("dctfweb_dossiers").select("*").eq("id",prepared.data).eq("organization_id",organizationId).single();
      if (dossierResult.error) throw dossierResult.error;
      return response({ok:true,eligible:true,reason:null,dossier:{...dossierResult.data,client_name:clientResult.data?.name || "Cliente"},taskContext:{taskId,instanceId,templateName:templateResult.data?.name || null}});
    }
    if (["consult_dctfweb_xml","consult_dctfweb_receipt","consult_dctfweb_report","generate_dctfweb_darf","transmit_dctfweb","get_dctfweb_artifact","approve_dctfweb"].includes(action)) {
      const dossierId=String(body.dossierId||""); if(!dossierId) throw new ConnectionInputError("invalid_request");
      const dossierResult=await db.from("dctfweb_dossiers").select("*").eq("id",dossierId).eq("organization_id",organizationId).maybeSingle();
      if(dossierResult.error) throw dossierResult.error; if(!dossierResult.data) return errorResponse("dossier_not_available",404);
      const dossier=dossierResult.data as Record<string,unknown>;
      if(action==="approve_dctfweb") {
        const version=Number(body.expectedVersion); if(version!==Number(dossier.data_version)) return errorResponse("version_conflict",409);
        const updated=await db.from("dctfweb_dossiers").update({status:"approved",approved_data_version:version,approved_by:auth.user.id,approved_at:new Date().toISOString(),updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId).select("*").single();
        if(updated.error) throw updated.error;
        await db.rpc("record_operational_audit_log",{_organization_id:organizationId,_action:"dctfweb.approved",_entity_type:"dctfweb_dossier",_entity_id:dossierId,_client_id:dossier.client_id,_result:"success",_metadata:{data_version:version},_request_id:null});
        return response({ok:true,dossier:updated.data});
      }
      const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!serviceKey) return errorResponse("operation_failed",500);
      const admin=createClient(url,serviceKey);
      if(action==="get_dctfweb_artifact") { const kind=String(body.artifact||""); const paths:Record<string,string|null>={xml:dossier.xml_storage_path as string|null,receipt:dossier.receipt_storage_path as string|null,report:dossier.report_storage_path as string|null,darf:dossier.darf_storage_path as string|null}; if(!paths[kind]) return errorResponse("artifact_not_available",404); const signed=await admin.storage.from("obligation-files").createSignedUrl(paths[kind]!,120); if(signed.error) throw signed.error; return response({ok:true,signedUrl:signed.data.signedUrl}); }
      const clientResult=await db.from("clients").select("cnpj").eq("id",String(dossier.client_id)).eq("organization_id",organizationId).single(); if(clientResult.error) throw clientResult.error;
      const input:DctfwebInput={cnpj:String(clientResult.data.cnpj||""),competence:String(dossier.competence_key),category:String(dossier.category) as DctfwebCategory,receiptNumber:String(body.receiptNumber||dossier.receipt_number||"")||null};
      const tag=`dctf-${dossierId.replace(/-/g,"").slice(0,18)}`;
      const mode=body.mode==="in_progress"?"in_progress":"transmitted";
      let artifactInstanceId=String(dossier.obligation_instance_id);
      if(action==="generate_dctfweb_darf"&&body.targetObligationInstanceId) {
        const targetId=String(body.targetObligationInstanceId);
        const targetResult=await db.from("obligation_instances").select("id,client_id,template_id,competence_key").eq("id",targetId).eq("organization_id",organizationId).maybeSingle();
        if(targetResult.error) throw targetResult.error;
        if(!targetResult.data||String(targetResult.data.client_id)!==String(dossier.client_id)||String(targetResult.data.competence_key).replace(/\D/g,"").slice(0,6)!==String(dossier.competence_key)) return errorResponse("darf_obligation_mismatch",409);
        const targetTemplate=await db.from("obligation_templates").select("code,name").eq("id",targetResult.data.template_id).eq("organization_id",organizationId).maybeSingle();
        if(targetTemplate.error) throw targetTemplate.error;
        const targetIdentity=`${targetTemplate.data?.code||""} ${targetTemplate.data?.name||""}`.toLowerCase().replace(/[^a-z0-9]/g,"");
        if(!targetIdentity.includes("darfinss")) return errorResponse("darf_obligation_mismatch",409);
        artifactInstanceId=targetId;
      }
      const idempotencyKey=`${dossierId}:${action}:${artifactInstanceId}:${mode}:${input.receiptNumber||"none"}:v${Number(dossier.data_version)}`;
      const existingOperation=await db.from("dctfweb_operations").select("id,status,metadata").eq("organization_id",organizationId).eq("idempotency_key",idempotencyKey).maybeSingle();
      if(existingOperation.error) throw existingOperation.error;
      if(existingOperation.data?.status==="completed") return response({ok:true,cacheHit:true,operationId:existingOperation.data.id});
      if(action==="transmit_dctfweb"&&existingOperation.data?.status==="transmission_unknown") return errorResponse("transmission_status_unknown",409);
      const operationPayload={organization_id:organizationId,dossier_id:dossierId,task_id:body.taskId?String(body.taskId):null,service_key:action,idempotency_key:idempotencyKey,status:"processing",request_tag:tag,metadata:{mode,data_version:Number(dossier.data_version)},created_by:auth.user.id,finished_at:null,error_code:null};
      const operation=existingOperation.data
        ? await db.from("dctfweb_operations").update(operationPayload).eq("id",existingOperation.data.id).select("id").single()
        : await db.from("dctfweb_operations").insert(operationPayload).select("id").single();
      if(operation.error) throw operation.error;
      const operationId=operation.data.id;
      if((Deno.env.get("INTEGRA_CONTADOR_PROVIDER")||"fake")!=="trial") {
        await db.from("dctfweb_operations").update({status:"failed",error_code:"EXTERNAL_CONTRACT_UNVERIFIED",finished_at:new Date().toISOString()}).eq("id",operationId);
        return errorResponse("EXTERNAL_CONTRACT_UNVERIFIED",409);
      }
      if(action==="transmit_dctfweb") {
        if(body.confirmation!=="TRANSMITIR DCTFWEB"||dossier.status!=="approved"||Number(dossier.approved_data_version)!==Number(dossier.data_version)) {
          await db.from("dctfweb_operations").update({status:"failed",error_code:"transmission_not_approved",finished_at:new Date().toISOString()}).eq("id",operationId);
          return errorResponse("transmission_not_approved",409);
        }
        const signedXml=String(body.signedXmlBase64||""); if(!signedXml) throw new ConnectionInputError("signed_xml_required");
        let xmlBytes:Uint8Array;
        try { xmlBytes=decodeBase64(signedXml); } catch { throw new ConnectionInputError("invalid_signed_xml"); }
        if(xmlBytes.length===0||xmlBytes.length>5*1024*1024) throw new ConnectionInputError("invalid_signed_xml_size");
        const xmlDigest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",xmlBytes.slice().buffer))].map(v=>v.toString(16).padStart(2,"0")).join("");
        const xmlPath=`${organizationId}/dctfweb/${dossierId}/signed-xml-${xmlDigest.slice(0,16)}.xml`;
        const xmlUpload=await admin.storage.from("obligation-files").upload(xmlPath,xmlBytes,{contentType:"application/xml",upsert:false});
        if(xmlUpload.error&&!xmlUpload.error.message.toLowerCase().includes("exist")) throw xmlUpload.error;
        const xmlArtifact=await db.from("dctfweb_artifacts").upsert({organization_id:organizationId,dossier_id:dossierId,obligation_instance_id:dossier.obligation_instance_id,artifact_type:"xml",storage_path:xmlPath,content_sha256:xmlDigest,mime_type:"application/xml",byte_size:xmlBytes.length,provider_reference:null,created_by:auth.user.id},{onConflict:"dossier_id,artifact_type,content_sha256"});
        if(xmlArtifact.error) throw xmlArtifact.error;
        await db.from("dctfweb_dossiers").update({status:"transmitting",xml_storage_path:xmlPath,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId);
        try {
          const result=await transmitDctfwebTrial({...input,signedXmlBase64:signedXml},tag);
          const transmittedReceipt=result.numeroReciboEntrega==null?dossier.receipt_number:String(result.numeroReciboEntrega);
          const updated=await db.from("dctfweb_dossiers").update({status:"transmitted",receipt_number:transmittedReceipt,provider_state:result,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId); if(updated.error) throw updated.error;
          await db.from("dctfweb_operations").update({status:"completed",finished_at:new Date().toISOString(),metadata:{mode,data_version:Number(dossier.data_version),xml_sha256:xmlDigest}}).eq("id",operationId);
          await db.rpc("record_operational_audit_log",{_organization_id:organizationId,_action:"dctfweb.transmitted",_entity_type:"dctfweb_dossier",_entity_id:dossierId,_client_id:dossier.client_id,_result:"success",_metadata:{data_version:Number(dossier.data_version),operation_id:operationId},_request_id:tag});
          return response({ok:true,result,operationId});
        } catch(error) {
          const message=error instanceof Error?error.message:"transmission_failed";
          const ambiguous=/SERPRO_HTTP_(500|503)|network|fetch/i.test(message);
          const failedStatus=ambiguous?"transmission_unknown":"requires_action";
          await db.from("dctfweb_dossiers").update({status:failedStatus,updated_by:auth.user.id,updated_at:new Date().toISOString()}).eq("id",dossierId).eq("organization_id",organizationId);
          await db.from("dctfweb_operations").update({status:ambiguous?"transmission_unknown":"failed",error_code:message.slice(0,120),finished_at:new Date().toISOString()}).eq("id",operationId);
          throw error;
        }
      }
      const type=action==="consult_dctfweb_xml"?"xml":action==="consult_dctfweb_receipt"?"receipt":action==="consult_dctfweb_report"?"complete_report":"darf";
      try {
        const result=action==="consult_dctfweb_xml"?await consultDctfwebXmlTrial(input,tag):action==="consult_dctfweb_receipt"?await consultDctfwebReceiptTrial(input,tag):action==="consult_dctfweb_report"?await consultDctfwebReportTrial(input,tag):await generateDctfwebDarfTrial(input,body.mode==="in_progress",tag);
        const bytes=decodeBase64(result.base64); const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join(""); const ext=result.mimeType==="application/xml"?"xml":"pdf"; const path=`${organizationId}/dctfweb/${dossierId}/${type}-${mode}-${digest.slice(0,16)}.${ext}`;
        const uploaded=await admin.storage.from("obligation-files").upload(path,bytes,{contentType:result.mimeType,upsert:false}); if(uploaded.error && !uploaded.error.message.toLowerCase().includes("exist")) throw uploaded.error;
        const art=await db.from("dctfweb_artifacts").upsert({organization_id:organizationId,dossier_id:dossierId,obligation_instance_id:artifactInstanceId,artifact_type:type,storage_path:path,content_sha256:digest,mime_type:result.mimeType,byte_size:bytes.length,provider_reference:result.receiptNumber||null,created_by:auth.user.id},{onConflict:"dossier_id,artifact_type,content_sha256"}); if(art.error) throw art.error;
        if (type === "receipt" || type === "complete_report" || type === "darf") {
          await publishDctfwebArtifactToObligation(admin, {
            organizationId,
            instanceId: artifactInstanceId,
            actorId: auth.user.id,
            artifactType: type,
            storagePath: path,
            byteSize: bytes.length,
            receiptNumber: result.receiptNumber || input.receiptNumber || null,
            competenceKey: String(dossier.competence_key),
          });
        }
        const column=type==="xml"?"xml_storage_path":type==="receipt"?"receipt_storage_path":type==="complete_report"?"report_storage_path":"darf_storage_path";
        const isDeclarationRefresh=type==="xml";
        const isSeparateDarfObligation=type==="darf"&&artifactInstanceId!==String(dossier.obligation_instance_id);
        const nextStatus=type==="darf"?(isSeparateDarfObligation?dossier.status:"documents_issued"):isDeclarationRefresh?"consulted":["transmitted","completed"].includes(String(dossier.status))?dossier.status:"consulted";
        const providerState={...((dossier.provider_state||{}) as Record<string,unknown>),[type]:result.metadata};
        const updated=await db.from("dctfweb_dossiers").update({
          [column]:path,
          receipt_number:result.receiptNumber||dossier.receipt_number,
          status:nextStatus,
          provider_state:providerState,
          ...(isDeclarationRefresh?{data_version:Number(dossier.data_version)+1,approved_data_version:null,approved_by:null,approved_at:null}:{}),
          updated_by:auth.user.id,
          updated_at:new Date().toISOString(),
        }).eq("id",dossierId).eq("organization_id",organizationId); if(updated.error) throw updated.error;
        await db.from("dctfweb_operations").update({status:"completed",finished_at:new Date().toISOString(),metadata:{mode,data_version:Number(dossier.data_version),artifact_type:type,content_sha256:digest}}).eq("id",operationId);
        await db.rpc("record_operational_audit_log",{_organization_id:organizationId,_action:`dctfweb.${action}`,_entity_type:"dctfweb_dossier",_entity_id:dossierId,_client_id:dossier.client_id,_result:"success",_metadata:{artifact_type:type,operation_id:operationId},_request_id:tag});
        return response({ok:true,artifact:type,cacheHit:false,operationId});
      } catch(error) {
        const message=error instanceof Error?error.message:"operation_failed";
        await db.from("dctfweb_operations").update({status:"failed",error_code:message.slice(0,120),finished_at:new Date().toISOString()}).eq("id",operationId);
        throw error;
      }
    }
    if (action === "get_task_simples_context") {
      const taskId = String(body.taskId || "");
      if (!taskId) throw new ConnectionInputError("invalid_request");
      const { data: task, error: taskError } = await db
        .from("kanban_tasks")
        .select("id,integration_source,integration_payload")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (taskError) throw taskError;
      if (!task || task.integration_source !== "grow_obligation_task") {
        return response({ ok: true, eligible: false, reason: "not_obligation_task", dossier: null });
      }
      const taskPayload = task.integration_payload && typeof task.integration_payload === "object"
        ? task.integration_payload as Record<string, unknown>
        : {};
      const instanceId = String(taskPayload.instance_id || "");
      if (!instanceId) return response({ ok: true, eligible: false, reason: "missing_obligation_instance", dossier: null });

      const { data: instance, error: instanceError } = await db
        .from("obligation_instances")
        .select("id,client_id,template_id,competence_key")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (instanceError) throw instanceError;
      if (!instance) return response({ ok: true, eligible: false, reason: "obligation_instance_not_available", dossier: null });
      const { data: template, error: templateError } = await db
        .from("obligation_templates")
        .select("code,name")
        .eq("id", instance.template_id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (templateError) throw templateError;
      const templateCode = String(template?.code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const isDasTask = templateCode === "das";
      const kind = ["pgdasd", "pgdasdmensal", "das"].includes(templateCode) ? "pgdasd" : templateCode === "defis" ? "defis" : null;
      if (!kind) return response({ ok: true, eligible: false, reason: "unsupported_obligation", dossier: null });

      const normalizedInstanceCompetence = String(instance.competence_key || "").replace(/\D/g, "");
      const competenceKey = kind === "defis"
        ? normalizedInstanceCompetence.slice(0, 4)
        : normalizedInstanceCompetence.slice(0, 6);
      const validTaskCompetence = kind === "defis" ? /^\d{4}$/.test(competenceKey) : /^\d{6}$/.test(competenceKey);
      if (!validTaskCompetence) {
        return response({ ok: true, eligible: false, reason: "invalid_obligation_competence", dossier: null });
      }
      let dossierQuery = db
        .from("simple_national_dossiers")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("client_id", instance.client_id)
        .eq("obligation_kind", kind);
      dossierQuery = isDasTask
        ? dossierQuery.eq("competence_key", competenceKey)
        : dossierQuery.eq("obligation_instance_id", instance.id);
      const dossierResult = await dossierQuery.maybeSingle();
      if (dossierResult.error) throw dossierResult.error;
      let dossier = dossierResult.data;
      if (!dossier) {
        const { data: dossierId, error: createError } = await db.rpc("create_simple_national_dossier", {
          _organization_id: organizationId,
          _client_id: instance.client_id,
          _kind: kind,
          _competence_key: competenceKey,
          _obligation_instance_id: isDasTask ? null : instance.id,
        });
        if (createError) throw createError;
        const result = await db.from("simple_national_dossiers").select("*").eq("id", dossierId).eq("organization_id", organizationId).single();
        if (result.error) throw result.error;
        dossier = result.data;
      }
      const { data: client, error: clientError } = await db
        .from("clients")
        .select("name")
        .eq("id", instance.client_id)
        .eq("organization_id", organizationId)
        .single();
      if (clientError) throw clientError;
      return response({
        ok: true,
        eligible: true,
        reason: null,
        dossier: { ...dossier, client_name: client.name },
        taskContext: { taskId, instanceId: instance.id, templateName: template?.name || null },
      });
    }
    if (action === "create_simples_dossier") {
      const clientId = String(body.clientId || "");
      const kind = String(body.kind || "");
      const competenceKey = String(body.competenceKey || "").replace(/\D/g, "");
      const validCompetence = kind === "pgdasd" ? /^\d{6}$/.test(competenceKey) : /^\d{4}$/.test(competenceKey);
      if (!clientId || !["pgdasd", "defis"].includes(kind) || !validCompetence) {
        throw new ConnectionInputError("invalid_request");
      }
      const { data, error } = await db.rpc("create_simple_national_dossier", {
        _organization_id: organizationId,
        _client_id: clientId,
        _kind: kind,
        _competence_key: competenceKey,
        _obligation_instance_id: body.obligationInstanceId || null,
      });
      if (error) throw error;
      return response({ ok: true, dossierId: data });
    }
    if (action === "save_simples_dossier") {
      const dossierId = String(body.dossierId || "");
      if (!dossierId || typeof body.inputData !== "object" || !Array.isArray(body.sourceManifest)) throw new ConnectionInputError("invalid_request");
      const { data, error } = await db.rpc("save_simple_national_dossier", {
        _organization_id: organizationId,
        _dossier_id: dossierId,
        _input_data: body.inputData,
        _source_manifest: body.sourceManifest,
      });
      if (error) throw error;
      return response({ ok: true, dossier: data });
    }
    if (action === "approve_simples_dossier") {
      const dossierId = String(body.dossierId || "");
      const expectedVersion = Number(body.expectedVersion);
      if (!dossierId || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ConnectionInputError("invalid_request");
      const { data, error } = await db.rpc("approve_simple_national_dossier", {
        _organization_id: organizationId, _dossier_id: dossierId, _expected_version: expectedVersion,
      });
      if (error) throw error;
      return response({ ok: true, dossier: data });
    }
    if (action === "request_simples_transmission") {
      const dossierId = String(body.dossierId || "");
      if (!dossierId) throw new ConnectionInputError("invalid_request");
      // Trial/fake providers must never create an external fiscal effect.
      if ((Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake") !== "serpro") {
        const { data, error } = await db.rpc("request_simple_national_transmission", {
          _organization_id: organizationId, _dossier_id: dossierId,
        });
        if (error) throw error;
        return response({ ok: true, dossier: data });
      }
      return errorResponse("EXTERNAL_CONTRACT_UNVERIFIED", 409);
    }
    if (action === "sync_defis_annual_values") {
      const dossierId = String(body.dossierId || "");
      if (!dossierId) throw new ConnectionInputError("invalid_request");
      const { data, error } = await db.rpc("sync_defis_annual_pgdas_values", {
        _organization_id: organizationId,
        _dossier_id: dossierId,
      });
      if (error) throw error;
      const inputData = ((data as Record<string, unknown>)?.input_data || {}) as Record<string, unknown>;
      return response({
        ok: true,
        dossier: data,
        monthsComplete: Number(inputData.pgdas_months_complete || 0),
        annualRevenue: Number(inputData.annual_revenue || 0),
      });
    }
    if (["sync_defis_declarations", "transmit_defis", "get_defis_artifact"].includes(action)) {
      const dossierId = String(body.dossierId || "");
      if (!dossierId) throw new ConnectionInputError("invalid_request");
      const { data: dossier, error: dossierError } = await db.from("simple_national_dossiers").select("*").eq("id", dossierId).eq("organization_id", organizationId).maybeSingle();
      if (dossierError) throw dossierError;
      if (!dossier || dossier.obligation_kind !== "defis") return errorResponse("dossier_not_available", 404);
      if ((Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake") !== "trial") return errorResponse("EXTERNAL_CONTRACT_UNVERIFIED", 409);
      const requestTag = dossierId.replaceAll("-", "").slice(0, 32);

      if (action === "sync_defis_declarations") {
        const declarations = await listDefisDeclarationsTrial(requestTag);
        const { data, error } = await db.rpc("record_defis_declarations_sync", { _organization_id: organizationId, _dossier_id: dossierId, _declarations: declarations });
        if (error) throw error;
        return response({ ok: true, dossier: data });
      }

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceKey) return errorResponse("operation_failed", 500);
      const admin = createClient(url, serviceKey);
      if (action === "transmit_defis") {
        if (String(body.confirmation || "") !== "TRANSMITIR DEFIS") return errorResponse("explicit_confirmation_required", 409);
        const defisData = (dossier.input_data || {}) as Record<string, unknown>;
        if (Number(defisData.pgdas_months_complete || 0) !== 12) return errorResponse("defis_pgdas_months_incomplete", 409);
        const result = await transmitDefisTrial(defisInput(dossier), requestTag);
        const basePath = `${organizationId}/${dossier.client_id}/defis/${dossierId}`;
        const declarationPath = `${basePath}/declaracao.pdf`;
        const receiptPath = `${basePath}/recibo.pdf`;
        const declarationBytes = decodeBase64(result.declarationPdf);
        const receiptBytes = decodeBase64(result.receiptPdf);
        const uploadResults = await Promise.all([
          admin.storage.from("obligation-files").upload(declarationPath, declarationBytes, { contentType: "application/pdf", upsert: true }),
          admin.storage.from("obligation-files").upload(receiptPath, receiptBytes, { contentType: "application/pdf", upsert: true }),
        ]);
        if (uploadResults.some((item) => item.error)) throw new Error("DEFIS_ARTIFACT_UPLOAD_FAILED");
        const { data, error } = await db.rpc("record_defis_transmission", { _organization_id: organizationId, _dossier_id: dossierId, _expected_version: dossier.data_version, _external_declaration_id: result.declarationId, _declaration_storage_path: declarationPath, _receipt_storage_path: receiptPath });
        if (error) throw error;
        if (dossier.obligation_instance_id) {
          await publishDefisDocumentsToObligation(admin, {
            organizationId,
            instanceId: String(dossier.obligation_instance_id),
            actorId: auth.user.id,
            year: String(dossier.competence_key),
            declarationId: result.declarationId,
            declarationPath,
            declarationSize: declarationBytes.length,
            receiptPath,
            receiptSize: receiptBytes.length,
          });
        }
        return response({ ok: true, dossier: data });
      }

      const artifact = String(body.artifact || "");
      const paths: Record<string, string | null> = { declaration: dossier.declaration_storage_path, receipt: dossier.receipt_storage_path };
      if (!paths[artifact]) return errorResponse("artifact_not_available", 404);
      const signed = await admin.storage.from("obligation-files").createSignedUrl(paths[artifact]!, 120);
      if (signed.error || !signed.data?.signedUrl) throw new Error("artifact_not_available");
      return response({ ok: true, signedUrl: signed.data.signedUrl });
    }
    if (["sync_pgdasd_previous_competence", "preview_pgdasd", "transmit_pgdasd", "generate_pgdasd_das", "get_pgdasd_artifact"].includes(action)) {
      const dossierId = String(body.dossierId || "");
      if (!dossierId) throw new ConnectionInputError("invalid_request");
      const { data: dossier, error: dossierError } = await db.from("simple_national_dossiers").select("*").eq("id", dossierId).eq("organization_id", organizationId).maybeSingle();
      if (dossierError) throw dossierError;
      if (!dossier || dossier.obligation_kind !== "pgdasd") return errorResponse("dossier_not_available", 404);
      const provider = Deno.env.get("INTEGRA_CONTADOR_PROVIDER") || "fake";
      if (provider !== "trial") return errorResponse("EXTERNAL_CONTRACT_UNVERIFIED", 409);
      const requestTag = dossierId.replaceAll("-", "").slice(0, 32);

      if (action === "sync_pgdasd_previous_competence") {
        const currentCompetence = String(dossier.competence_key || "");
        const referenceCompetence = previousCompetence(currentCompetence);
        const result = await consultPreviousPgdasTrial(currentCompetence, requestTag);
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!serviceKey) return errorResponse("operation_failed", 500);
        const admin = createClient(url, serviceKey);
        const artifactPath = result.declarationPdf
          ? `${organizationId}/${dossier.client_id}/pgdasd/${dossierId}/consulta-${referenceCompetence}.pdf`
          : null;
        if (result.declarationPdf && artifactPath) {
          const uploaded = await admin.storage.from("obligation-files").upload(
            artifactPath,
            decodeBase64(result.declarationPdf),
            { contentType: "application/pdf", upsert: true },
          );
          if (uploaded.error) throw new Error("PGDASD_PREVIOUS_ARTIFACT_UPLOAD_FAILED");
        }
        const referenceMonth = `${referenceCompetence.slice(0, 4)}-${referenceCompetence.slice(4, 6)}-01`;
        const { data, error } = await db.rpc("sync_pgdas_previous_competence_values", {
          _organization_id: organizationId,
          _dossier_id: dossierId,
          _reference_month: referenceMonth,
          _gross_revenue: result.grossRevenue,
          _source_declaration_id: result.declarationId,
          _source_artifact_path: artifactPath,
        });
        if (error) throw error;
        const syncedInput = ((data as Record<string, unknown>)?.input_data || {}) as Record<string, unknown>;
        const previousValues = (syncedInput.previous_competence_values || {}) as Record<string, unknown>;
        return response({
          ok: true,
          dossier: data,
          previousCompetence: referenceCompetence,
          grossRevenue: result.grossRevenue,
          payrollLinked: previousValues.relation_status === "linked",
        });
      }

      if (["preview_pgdasd", "transmit_pgdasd"].includes(action)) {
        const { data: client, error: clientError } = await db
          .from("clients")
          .select("is_factor_r")
          .eq("organization_id", organizationId)
          .eq("id", dossier.client_id)
          .single();
        if (clientError) throw clientError;
        if (client?.is_factor_r) {
          const inputData = (dossier.input_data || {}) as Record<string, unknown>;
          const linkedValues = (inputData.previous_competence_values || {}) as Record<string, unknown>;
          if (linkedValues.relation_status !== "linked") {
            return errorResponse("factor_r_previous_competence_not_linked", 409);
          }
          const competence = String(dossier.competence_key || "");
          const competenceDate = `${competence.slice(0, 4)}-${competence.slice(4, 6)}-01`;
          const calculation = await db.rpc("calculate_client_factor_r", {
            _organization_id: organizationId,
            _client_id: dossier.client_id,
            _competence_date: competenceDate,
          });
          if (calculation.error) throw calculation.error;
          const factorR = Array.isArray(calculation.data) ? calculation.data[0] : calculation.data;
          if (!factorR || factorR.status === "insufficient_data") return errorResponse("factor_r_data_incomplete", 409);
          if (Number(factorR.factor_r) < 0.28) return errorResponse("factor_r_below_threshold", 409);
        }
      }

      if (action === "preview_pgdasd") {
        const result = await previewPgdasTrial(pgdasInput(dossier), requestTag);
        const { data, error } = await db.rpc("record_pgdasd_preview", { _organization_id: organizationId, _dossier_id: dossierId, _expected_version: dossier.data_version, _preview: { taxValues: result.taxValues, calculatedAt: new Date().toISOString(), provider: "trial" } });
        if (error) throw error;
        return response({ ok: true, dossier: data });
      }

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceKey) return errorResponse("operation_failed", 500);
      const admin = createClient(url, serviceKey);
      const basePath = `${organizationId}/${dossier.client_id}/pgdasd/${dossierId}`;
      if (action === "transmit_pgdasd") {
        const confirmation = String(body.confirmation || "");
        if (confirmation !== "TRANSMITIR") return errorResponse("explicit_confirmation_required", 409);
        const result = await transmitPgdasTrial(pgdasInput(dossier), requestTag);
        const declarationPath = result.declarationPdf ? `${basePath}/declaracao.pdf` : null;
        const receiptPath = result.receiptPdf ? `${basePath}/recibo.pdf` : null;
        const uploads = [
          result.declarationPdf && declarationPath ? admin.storage.from("obligation-files").upload(declarationPath, decodeBase64(result.declarationPdf), { contentType: "application/pdf", upsert: true }) : Promise.resolve({ error: null }),
          result.receiptPdf && receiptPath ? admin.storage.from("obligation-files").upload(receiptPath, decodeBase64(result.receiptPdf), { contentType: "application/pdf", upsert: true }) : Promise.resolve({ error: null }),
        ];
        const uploadResults = await Promise.all(uploads);
        if (uploadResults.some((item) => item.error)) throw new Error("PGDASD_ARTIFACT_UPLOAD_FAILED");
        const { data, error } = await db.rpc("record_pgdasd_transmission", { _organization_id: organizationId, _dossier_id: dossierId, _expected_version: dossier.data_version, _external_declaration_id: result.declarationId || "", _external_transmitted_at: parseSerproTimestamp(result.transmittedAt), _declaration_storage_path: declarationPath, _receipt_storage_path: receiptPath, _tax_values: result.taxValues });
        if (error) throw error;
        return response({ ok: true, dossier: data });
      }
      if (action === "generate_pgdasd_das") {
        if (dossier.status !== "transmitted") return errorResponse("declaration_not_transmitted", 409);
        const result = await generateDasTrial(String(dossier.competence_key), requestTag);
        const dasPath = `${basePath}/das.pdf`;
        const uploaded = await admin.storage.from("obligation-files").upload(dasPath, decodeBase64(result.pdf), { contentType: "application/pdf", upsert: true });
        if (uploaded.error) throw new Error("PGDASD_ARTIFACT_UPLOAD_FAILED");
        const { data, error } = await db.rpc("record_pgdasd_das", { _organization_id: organizationId, _dossier_id: dossierId, _das_storage_path: dasPath, _das_number: result.dasNumber || "", _das_due_date: parseSerproDate(result.dueDate), _das_total: result.total });
        if (error) throw error;
        return response({ ok: true, dossier: data });
      }
      const artifact = String(body.artifact || "");
      const paths: Record<string, string | null> = { declaration: dossier.declaration_storage_path, receipt: dossier.receipt_storage_path, das: dossier.das_storage_path };
      if (!paths[artifact]) return errorResponse("artifact_not_available", 404);
      const signed = await admin.storage.from("obligation-files").createSignedUrl(paths[artifact]!, 120);
      if (signed.error || !signed.data?.signedUrl) throw new Error("artifact_not_available");
      return response({ ok: true, signedUrl: signed.data.signedUrl });
    }
    throw new ConnectionInputError("invalid_request");
  } catch (error) {
    const code = error instanceof ConnectionInputError ? error.code : String((error as { message?: string }).message || "operation_failed");
    console.error("[integra-contador-module] request failed", { code, errorType: error instanceof Error ? error.name : "unknown" });
    if (code.includes("forbidden") || code.includes("permission")) return errorResponse("forbidden", 403);
    if (code.includes("organization_not_available")) return errorResponse("organization_not_available", 404);
    if (code.includes("canonical_obligation_instance_not_generated")) return errorResponse("canonical_obligation_instance_not_generated", 409);
    if (code.includes("client_not_available")) return errorResponse("client_not_available", 404);
    if (code.includes("client_not_simples_nacional")) return errorResponse("client_not_simples_nacional", 409);
    if (["invalid_request", "certificate_invalid"].includes(code)) return errorResponse(code, 400);
    return errorResponse("operation_failed", 500);
  }
});
