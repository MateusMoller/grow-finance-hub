import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "D:/grow-finance-hub-main/outputs/sprint-obrigacoes-2026-08";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sprint = workbook.worksheets.add("Sprint dia a dia");
const backlog = workbook.worksheets.add("Backlog priorizado");
const checklist = workbook.worksheets.add("Checklist final");

const colors = {
  navy: "#111827",
  slate: "#4B5563",
  muted: "#6B7280",
  border: "#D9DEE8",
  header: "#EEF2FF",
  accent: "#4F46E5",
  soft: "#F8FAFC",
  high: "#FEE2E2",
  medium: "#FEF3C7",
  low: "#DCFCE7",
};

function styleTitle(sheet, range, title, subtitle) {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range);
  cell.values = [[`${title}\n${subtitle}`]];
  cell.format = {
    fill: "#FFFFFF",
    font: { bold: true, color: colors.navy, size: 16 },
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: colors.border },
  };
  cell.format.rowHeightPx = 58;
}

function styleHeader(range) {
  range.format = {
    fill: colors.header,
    font: { bold: true, color: colors.navy },
    borders: { preset: "insideHorizontal", style: "thin", color: colors.border },
    wrapText: true,
  };
}

function styleBody(range) {
  range.format = {
    fill: "#FFFFFF",
    font: { color: colors.navy },
    borders: { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" },
    wrapText: true,
  };
}

const sprintRows = [
  [
    "Dia",
    "Foco",
    "Objetivo",
    "Atividades do dia",
    "Entrega esperada",
    "Critério de aceite",
    "Status",
  ],
  [
    "Dia 1",
    "Mapeamento e decisões",
    "Entender o fluxo atual e fechar o fluxo oficial da sprint.",
    "Revisar cadastro da obrigação, documento esperado, vínculo com empresa, geração de tarefa, anexo, leitura do robô, envio ao cliente e baixa. Separar regra válida de legado. Validar exemplos reais: folha, FGTS, PGDAS, IRPJ/CSLL e recibo de salário.",
    "Mapa técnico do fluxo, lista de decisões e lista de funções/componentes legado.",
    "Existe uma definição clara do fluxo que continuará no sistema e do que será removido.",
    "Não iniciado",
  ],
  [
    "Dia 2",
    "Regras de obrigação",
    "Corrigir e centralizar competência, vencimento e geração de tarefas.",
    "Validar mês base anterior e vigente, dia fixo, dia útil, mensal, trimestral, anual e múltiplas datas anuais. Conferir geração no dia 27, deduplicação e vínculo por regime tributário.",
    "Regras centrais revisadas e exemplos reais validados.",
    "Obrigação mensal, anual e por dia útil geram tarefa com competência e vencimento corretos.",
    "Não iniciado",
  ],
  [
    "Dia 3",
    "Documentos e robô",
    "Melhorar o reconhecimento dos documentos esperados.",
    "Revisar PDFs reais, cadastrar modelos, marcar áreas de CNPJ e competência, testar upload e corrigir identificação de obrigação, cliente e competência. Evitar dependência do nome do arquivo.",
    "Central de documentos com leitura mais segura e correção manual clara.",
    "O robô lê apenas as áreas marcadas e não sugere obrigação errada para documentos modelo configurados.",
    "Não iniciado",
  ],
  [
    "Dia 4",
    "Calendário operacional",
    "Reformular o calendário como visão de controle das obrigações.",
    "Mostrar vencimentos por data, agrupar obrigações em collapses, listar empresas dentro de cada obrigação, exibir status visual e manter tarefas comuns do dia separadas.",
    "Calendário operacional com obrigações e tarefas do dia em uma visão clara.",
    "O calendário permite identificar o que vence no dia, por obrigação, cliente e status.",
    "Não iniciado",
  ],
  [
    "Dia 5",
    "WhatsApp, legado e fechamento",
    "Validar integração, remover legado e preparar fechamento da sprint.",
    "Testar vínculo obrigação/tarefa/cliente no WhatsApp, revisar envio piloto, remover funções antigas, testar fluxo ponta a ponta e preparar resumo da sprint.",
    "Fluxo demonstrável, legado crítico removido e pendências registradas.",
    "O fluxo completo pode ser apresentado com início, meio, fim e histórico mínimo.",
    "Não iniciado",
  ],
];

styleTitle(
  sprint,
  "A1:G1",
  "Planejamento da Sprint - Módulo de Obrigações",
  "Sprint reduzida de 1 semana focada em refatoração, calendário, documentos, WhatsApp e limpeza de legado."
);
sprint.getRange("A3:G8").values = sprintRows;
styleHeader(sprint.getRange("A3:G3"));
styleBody(sprint.getRange("A4:G8"));
sprint.getRange("A3:G8").format.borders = { preset: "outside", style: "thin", color: colors.border };
sprint.getRange("A:A").format.columnWidthPx = 78;
sprint.getRange("B:B").format.columnWidthPx = 180;
sprint.getRange("C:C").format.columnWidthPx = 250;
sprint.getRange("D:D").format.columnWidthPx = 430;
sprint.getRange("E:E").format.columnWidthPx = 280;
sprint.getRange("F:F").format.columnWidthPx = 330;
sprint.getRange("G:G").format.columnWidthPx = 120;
sprint.getRange("A4:G8").format.rowHeightPx = 104;
sprint.freezePanes.freezeRows(3);
sprint.showGridLines = false;
sprint.tables.add("A3:G8", true, "TabelaSprint").style = "TableStyleMedium2";
sprint.getRange("G4:G8").dataValidation = {
  rule: { type: "list", values: ["Não iniciado", "Em andamento", "Concluído", "Bloqueado"] },
};

const backlogRows = [
  ["Prioridade", "Tema", "Item", "Resultado esperado", "Observações"],
  ["Alta", "Refatoração", "Centralizar regras de competência e vencimento", "Menos duplicidade e menor risco de cálculo divergente.", "Base para todo o fluxo."],
  ["Alta", "Geração automática", "Validar job do dia 27 e evitar duplicidade", "Tarefas geradas automaticamente sem ação do usuário.", "Registrar log da execução."],
  ["Alta", "Robô", "Ler CNPJ e competência apenas nas áreas marcadas", "Reconhecimento mais estável por documento modelo.", "Evitar dependência do nome do arquivo."],
  ["Alta", "Documentos", "Melhorar vínculo documento, cliente e competência", "Upload em lote com correção manual rápida.", "Exibir motivo de falha com clareza."],
  ["Média", "Calendário", "Reformular visão operacional", "Obrigações agrupadas e tarefas comuns no mesmo dia.", "Collapses fechados por padrão."],
  ["Média", "WhatsApp", "Preparar envio/vínculo com cliente", "Primeiro fluxo funcional ou piloto validado.", "Não substituir e-mail se instável."],
  ["Média", "Auditoria", "Criar logs mínimos", "Histórico rastreável da obrigação até o envio.", "Inclui falhas e correções manuais."],
  ["Baixa", "Visual", "Ajustes finos de UI e ortografia", "Tela mais clara e menos ambígua.", "Fazer após estabilizar regras."],
  ["Baixa", "Relatórios", "Painel gerencial completo", "Indicadores consolidados.", "Fora do escopo principal da semana."],
];

styleTitle(
  backlog,
  "A1:E1",
  "Backlog Priorizado",
  "Itens organizados por prioridade para controlar o escopo da sprint."
);
backlog.getRange("A3:E12").values = backlogRows;
styleHeader(backlog.getRange("A3:E3"));
styleBody(backlog.getRange("A4:E12"));
backlog.getRange("A:A").format.columnWidthPx = 95;
backlog.getRange("B:B").format.columnWidthPx = 150;
backlog.getRange("C:C").format.columnWidthPx = 330;
backlog.getRange("D:D").format.columnWidthPx = 330;
backlog.getRange("E:E").format.columnWidthPx = 260;
backlog.getRange("A4:E12").format.rowHeightPx = 58;
backlog.freezePanes.freezeRows(3);
backlog.showGridLines = false;
backlog.tables.add("A3:E12", true, "TabelaBacklog").style = "TableStyleMedium2";
backlog.getRange("A4:A5").format.fill = colors.high;
backlog.getRange("A6:A8").format.fill = colors.high;
backlog.getRange("A9:A11").format.fill = colors.medium;
backlog.getRange("A12:A12").format.fill = colors.low;

const checklistRows = [
  ["Pergunta de validação", "Resposta", "Observações"],
  ["A obrigação gera tarefa corretamente?", "", ""],
  ["A competência está correta?", "", ""],
  ["O vencimento técnico está correto?", "", ""],
  ["O vencimento legal está correto?", "", ""],
  ["O documento esperado está cadastrado?", "", ""],
  ["O robô identifica cliente e competência?", "", ""],
  ["O usuário consegue corrigir manualmente?", "", ""],
  ["O calendário mostra a operação do dia?", "", ""],
  ["O histórico registra o que aconteceu?", "", ""],
  ["Existe alguma função legado ainda visível?", "", ""],
  ["O WhatsApp está pronto, piloto ou pendente?", "", ""],
];

styleTitle(
  checklist,
  "A1:C1",
  "Checklist Final da Sprint",
  "Use esta aba no encerramento para validar se a sprint está pronta para apresentação."
);
checklist.getRange("A3:C14").values = checklistRows;
styleHeader(checklist.getRange("A3:C3"));
styleBody(checklist.getRange("A4:C14"));
checklist.getRange("A:A").format.columnWidthPx = 430;
checklist.getRange("B:B").format.columnWidthPx = 150;
checklist.getRange("C:C").format.columnWidthPx = 420;
checklist.getRange("A4:C14").format.rowHeightPx = 42;
checklist.freezePanes.freezeRows(3);
checklist.showGridLines = false;
checklist.tables.add("A3:C14", true, "TabelaChecklist").style = "TableStyleMedium2";
checklist.getRange("B4:B14").dataValidation = {
  rule: { type: "list", values: ["Sim", "Não", "Parcial", "Pendente"] },
};

sprint.getRange("A1:G8").format.font = { name: "Aptos", color: colors.navy };
backlog.getRange("A1:E12").format.font = { name: "Aptos", color: colors.navy };
checklist.getRange("A1:C14").format.font = { name: "Aptos", color: colors.navy };

const sprintInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Sprint dia a dia",
  range: "A1:G8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 7,
  maxChars: 3000,
});
console.log(sprintInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Sprint dia a dia", "Backlog priorizado", "Checklist final"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/planejamento-sprint-obrigacoes.xlsx`);
console.log(`${outputDir}/planejamento-sprint-obrigacoes.xlsx`);
