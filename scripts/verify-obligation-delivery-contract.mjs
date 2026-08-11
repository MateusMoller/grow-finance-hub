import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const failures = [];
const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

function requireText(source, expected, description) {
  if (!source.includes(expected)) failures.push(description);
}

function forbidText(source, forbidden, description) {
  if (source.includes(forbidden)) failures.push(description);
}

const workspace = read("src/components/obligations/GrowObligationsWorkspace.tsx");
const processor = read("supabase/functions/obligation-document-processor/index.ts");
const delivery = read("supabase/functions/grow-obligations-module/index.ts");
const documentAccess = read("supabase/functions/obligation-document-access/index.ts");

requireText(workspace, "groupCentralDeliveries(processedDocuments)", "A central deve agrupar arquivos por instancia antes do envio.");
requireText(workspace, 'action: "send_configured_delivery"', "A central deve disparar o envio pelos canais configurados depois do processamento.");
requireText(workspace, "inbox_item_ids: delivery.inboxItemIds", "O envio deve informar somente os arquivos do lote atual.");
requireText(delivery, "human_confirmed: true", "O envio configurado deve registrar a confirmacao humana no backend.");

requireText(processor, "supabaseUser = createClient", "O processador deve autenticar o usuario separadamente.");
requireText(processor, "supabaseAdmin = createClient", "O processador deve usar o cliente administrativo apenas no backend.");
requireText(processor, '.select("id")', "A atualizacao da instancia deve retornar a linha alterada.");
requireText(processor, ".maybeSingle()", "A atualizacao da instancia deve detectar quando nenhuma linha foi alterada.");
requireText(processor, "throw updateError || new Error", "O processador nao pode registrar sucesso quando a instancia nao avancou.");

requireText(delivery, "payload.inbox_item_ids", "O backend deve aceitar o escopo explicito dos arquivos do lote.");
requireText(delivery, '.in("id", attachmentIds)', "Somente os arquivos do lote podem ser publicados.");
requireText(delivery, "createDeliveryDocumentLinks", "O envio deve criar links seguros para os documentos.");
requireText(delivery, "syncInstanceArtifacts", "Tarefa, instancia e calendario devem ser sincronizados apos o envio.");
requireText(delivery, '<a href="${escapeHtml(link.url)}">Clique aqui</a>', "O e-mail deve exibir o acesso ao documento como link comum.");
forbidText(delivery, "downloadDeliveryAttachments", "O documento nao deve voltar a ser enviado como anexo do e-mail.");
forbidText(delivery, 'style="display:block', "O link do documento nao deve voltar a ser apresentado como botao decorativo.");
forbidText(delivery, 'background:#f8fafc', "O e-mail de entrega nao deve voltar a usar um layout decorativo.");

requireText(documentAccess, "status: 302", "O primeiro clique deve redirecionar diretamente para o PDF.");
requireText(documentAccess, 'access_type: "view"', "A abertura direta deve continuar registrando a leitura do documento.");
forbidText(documentAccess, '<form method="post">', "O acesso ao PDF nao deve exigir uma segunda confirmacao.");
forbidText(documentAccess, "<iframe", "A funcao publica nao deve tentar servir uma pagina HTML intermediaria.");

if (failures.length > 0) {
  console.error("Contrato do fluxo de entrega violado:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Contrato do fluxo de entrega validado.");
