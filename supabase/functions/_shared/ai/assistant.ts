import type {
  AuthorizedClientContext,
  GrowAssistantRunResult,
  RunGrowAssistantParams,
  ToolExecutionResult,
} from "./types.ts";
import { getAuthorizedClientContext } from "./authorization.ts";
import { finalizeAiInteraction, logAiInteractionStart } from "./logging.ts";
import { buildDefaultAction, buildSafetyEnvelope } from "./risk.ts";
import { createOpenAIResponse, extractResponseText } from "./openaiClient.ts";
import { executeGrowAssistantTool, getGrowAssistantToolDefinitions } from "./tools.ts";
import { asTrimmedString } from "./utils.ts";

function buildAssistantInstructions(context: AuthorizedClientContext) {
  const serializedContext = {
    identidade_requisitante: {
      metodo: context.requester.identityMethod,
      verificada: context.requester.isIdentityVerified,
    },
    cliente_id: context.client.id,
    nome_razao_social: context.client.name,
    cnpj_mascarado: context.client.cnpjMasked,
    setor: context.client.sector,
    status_cliente: context.client.status,
    pendencias_abertas: context.pendingTasks.map((item) => ({
      id: item.id,
      titulo: item.title,
      status: item.status,
      setor: item.sector,
      vencimento: item.dueDate,
    })),
    chamados_recentes: context.recentRequests.map((item) => ({
      id: item.id,
      assunto: item.title,
      status: item.status,
      setor: item.sector,
      criado_em: item.createdAt,
    })),
    documentos_recentes: context.recentDocuments.map((item) => ({
      id: item.id,
      arquivo: item.fileName,
      categoria: item.category,
      criado_em: item.createdAt,
    })),
    guias_status: context.guideStatuses.map((item) => ({
      id: item.id,
      nome: item.obligationName,
      competencia: item.obligationPeriod,
      vencimento: item.dueDate,
      status: item.status,
    })),
    permissoes: context.permissions,
  };

  return [
    "Voce e a assistente operacional da Grow Contabilidade.",
    "Voce responde exclusivamente com base no contexto autorizado do cliente informado.",
    "Nunca misture informacoes entre clientes.",
    "Nunca invente dados.",
    "Se a informacao nao estiver no contexto ou nao puder ser obtida por uma tool autorizada, diga que nao localizou a informacao disponivel para este cliente.",
    "Quando a solicitacao envolver calculo, tributo, folha, obrigacao acessoria, emissao, cancelamento, alteracao cadastral sensivel ou orientacao tecnica definitiva, nao conclua sozinho: classifique a solicitacao e encaminhe para validacao da equipe responsavel.",
    "Voce pode auxiliar em triagem, abertura de chamados, consulta de pendencias, consulta de status, organizacao de documentos e geracao de resumos.",
    "Toda acao deve respeitar as permissoes do usuario e as regras do sistema.",
    "Se a identidade estiver marcada como nao verificada, evite fornecer qualquer conteudo sensivel diretamente e prefira confirmacao adicional, link seguro no portal ou validacao humana.",
    "Se usar uma ferramenta, utilize apenas o cliente_id autorizado ja fornecido no contexto.",
    `Contexto autorizado do cliente: ${JSON.stringify(serializedContext)}`,
  ].join("\n");
}

function collectFunctionCalls(response: Record<string, unknown>) {
  const output = Array.isArray(response.output) ? response.output : [];

  return output
    .filter((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "function_call")
    .map((item) => item as { call_id: string; name: string; arguments: string });
}

function deriveDetectedIntent(toolExecutions: ToolExecutionResult[]) {
  return toolExecutions.find((item) => item.detectedIntent)?.detectedIntent || null;
}

function deriveAction(toolExecutions: ToolExecutionResult[]) {
  let current = buildDefaultAction();

  for (const execution of toolExecutions) {
    if (execution.action.type !== "none") {
      current = execution.action;
    }
  }

  return current;
}

function buildFallbackReply(actionType: string) {
  if (actionType === "created_ticket") return "A solicitacao foi registrada com sucesso.";
  if (actionType === "duplicate_found") return "Localizei um registro semelhante e evitei criar duplicidade desnecessaria.";
  if (actionType === "confirmation_required") return "Identifiquei uma acao que precisa da sua confirmacao antes de continuar.";
  if (actionType === "human_review_required") return "Este pedido precisa de validacao humana antes de prosseguir.";
  return "Nao localizei informacao suficiente para responder com seguranca.";
}

export async function runGrowAssistant(params: RunGrowAssistantParams): Promise<GrowAssistantRunResult> {
  const authorizedContext = await getAuthorizedClientContext({
    supabaseAdmin: params.supabaseAdmin,
    userId: params.userId,
    requesterRoles: params.requesterRoles,
    clienteId: params.clienteId,
  });

  return await runGrowAssistantWithAuthorizedContext({
    ...params,
    authorizedContext,
  });
}

export async function runGrowAssistantWithAuthorizedContext(params: RunGrowAssistantParams & {
  authorizedContext?: AuthorizedClientContext;
}): Promise<GrowAssistantRunResult> {
  const context =
    params.authorizedContext ||
    await getAuthorizedClientContext({
      supabaseAdmin: params.supabaseAdmin,
      userId: params.userId,
      requesterRoles: params.requesterRoles,
      clienteId: params.clienteId,
    });

  const interaction = await logAiInteractionStart(params.supabaseAdmin, {
    cliente_id: context.client.id,
    user_id: params.userId,
    channel: params.channel,
    user_message: params.message,
    ai_response: null,
    detected_intent: null,
    risk_level: "baixo",
    action_requested: {
      channel: params.channel,
      attachments_count: params.attachments?.length || 0,
    },
    action_executed: {},
    requires_human_review: false,
  });

  const instructions = buildAssistantInstructions(context);
  const toolDefinitions = getGrowAssistantToolDefinitions();
  const toolExecutions: ToolExecutionResult[] = [];

  let response = await createOpenAIResponse({
    instructions,
    model: undefined,
    input: [
      {
        role: "user",
        content: params.message,
      },
    ],
    tools: toolDefinitions,
    parallel_tool_calls: false,
    store: false,
    metadata: {
      channel: params.channel,
      client_id: context.client.id,
      user_id: params.userId,
    },
  });

  let remainingToolRounds = 6;

  while (remainingToolRounds > 0) {
    const functionCalls = collectFunctionCalls(response as Record<string, unknown>);
    if (functionCalls.length === 0) break;

    const outputs: Array<Record<string, unknown>> = [];

    for (const functionCall of functionCalls) {
      const execution = await executeGrowAssistantTool({
        supabaseAdmin: params.supabaseAdmin,
        context,
        requesterUserId: params.userId,
        toolName: functionCall.name,
        rawArguments: functionCall.arguments,
      });

      toolExecutions.push(execution);
      outputs.push({
        type: "function_call_output",
        call_id: functionCall.call_id,
        output: JSON.stringify(execution.data),
      });
    }

    response = await createOpenAIResponse({
      previous_response_id: typeof response.id === "string" ? response.id : undefined,
      input: outputs,
      store: false,
    });

    remainingToolRounds -= 1;
  }

  const action = deriveAction(toolExecutions);
  const safety = buildSafetyEnvelope(toolExecutions);
  const detectedIntent = deriveDetectedIntent(toolExecutions);
  const reply = asTrimmedString(extractResponseText(response)) || buildFallbackReply(action.type);

  await finalizeAiInteraction(params.supabaseAdmin, interaction.id, {
    ai_response: reply,
    detected_intent: detectedIntent,
    risk_level: safety.riskLevel,
    action_executed: {
      action,
      tool_executions: toolExecutions.map((item) => ({
        tool: item.toolName,
        action: item.action.type,
        risk_level: item.riskLevel,
      })),
    },
    requires_human_review: safety.requiresHumanReview,
  });

  return {
    reply,
    action,
    safety,
    context: {
      clientId: context.client.id,
      clientName: context.client.name,
    },
    detectedIntent,
    toolExecutions,
    interactionId: interaction.id,
  };
}
