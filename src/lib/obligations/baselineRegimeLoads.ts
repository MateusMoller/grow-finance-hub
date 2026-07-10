import type { RegimeLoadApplicability, RegimeLoadConditionKey, TaxRegimeCode } from "./regimeLoadTypes";

export interface BaselineMasterObligation {
  code: string;
  name: string;
  sector: "Fiscal" | "Contabil" | "Departamento Pessoal";
  periodicity: "monthly" | "quarterly" | "yearly" | "custom";
  due_day: number;
  yearly_due_month: number | null;
  competence_reference: "vigente" | "anterior";
  technical_due_month_reference: "vigente" | "anterior";
  priority: "baixa" | "media" | "alta" | "urgente";
  requires_document: boolean;
}

export interface BaselineRegimeLoadItem {
  templateCode: string;
  applicability: RegimeLoadApplicability;
  conditionKey?: RegimeLoadConditionKey;
  sortOrder: number;
}

export interface BaselineRegimeLoad {
  taxRegimeCode: TaxRegimeCode;
  name: string;
  items: BaselineRegimeLoadItem[];
}

export const excludedSectorSpecificObligationCodes = new Set([
  "dmed",
  "dimob",
  "doi",
  "e_financeira",
  "cno",
  "sero",
]);

export const baselineMasterObligations: BaselineMasterObligation[] = [
  master("pgmei", "PGMEI/DAS MEI", "Fiscal", "monthly", 20, true),
  master("dasn_simei", "DASN-SIMEI", "Fiscal", "yearly", 31, true, 5),
  master("pgdas_d", "PGDAS-D", "Fiscal", "monthly", 20, true),
  master("defis", "DEFIS", "Fiscal", "yearly", 31, true, 3),
  master("dctfweb_mit", "DCTFWeb/MIT", "Fiscal", "monthly", 31, true),
  master("esocial", "eSocial", "Departamento Pessoal", "monthly", 15, true),
  master("fgts", "FGTS", "Departamento Pessoal", "monthly", 20, true),
  master("efd_reinf", "EFD-Reinf", "Fiscal", "monthly", 15, true),
  master("iss_municipal", "ISS Municipal", "Fiscal", "monthly", 10, true),
  master("municipal_service_tax_return", "Declaracao municipal de servicos", "Fiscal", "monthly", 10, true),
  master("nfse_municipal", "NFS-e / emissao fiscal municipal", "Fiscal", "monthly", 10, true),
  master("generic_state_obligations", "Obrigacoes estaduais genericas por UF", "Fiscal", "monthly", 20, true),
  master("generic_municipal_obligations", "Obrigacoes municipais genericas por municipio", "Fiscal", "monthly", 10, true),
  master("efd_icms_ipi", "EFD ICMS/IPI", "Fiscal", "monthly", 20, true),
  master("destda", "DeSTDA", "Fiscal", "monthly", 28, true),
  master("das_complementar_review", "Revisao de DAS complementar e ajustes", "Fiscal", "monthly", 20, true),
  master("simples_option_status_review", "Revisao anual da opcao pelo Simples Nacional", "Fiscal", "yearly", 31, true, 1),
  master("mei_revenue_support", "Controle de receita bruta MEI", "Fiscal", "monthly", 20, true),
  master("mei_status_limit_review", "Revisao anual de limite e status MEI", "Fiscal", "yearly", 31, true, 1),
  master("irpj_csll_presumido", "IRPJ/CSLL Lucro Presumido", "Fiscal", "quarterly", 31, true),
  master("pis_cofins_cumulativo", "PIS/COFINS cumulativo", "Fiscal", "monthly", 25, true),
  master("efd_contribuicoes", "EFD-Contribuicoes", "Fiscal", "monthly", 15, true),
  master("ecd", "ECD", "Contabil", "yearly", 30, true, 6),
  master("ecf", "ECF", "Contabil", "yearly", 31, true, 7),
  master("dirbi", "DIRBI", "Fiscal", "monthly", 20, true),
  master("irpj_csll_lucro_real", "IRPJ/CSLL Lucro Real", "Fiscal", "monthly", 31, true),
  master("pis_cofins_nao_cumulativo", "PIS/COFINS nao cumulativo", "Fiscal", "monthly", 25, true),
];

export const baselineRegimeLoads: BaselineRegimeLoad[] = [
  {
    taxRegimeCode: "mei",
    name: "MEI - Carga Padrao",
    items: [
      item("pgmei", "required", 10),
      item("dasn_simei", "required", 20),
      item("esocial", "conditional", 30, "has_employees"),
      item("fgts", "conditional", 40, "has_employees"),
      item("dctfweb_mit", "conditional", 50, "has_employees_or_retentions"),
      item("iss_municipal", "conditional", 60, "service_provider"),
      item("municipal_service_tax_return", "conditional", 70, "municipal_service_declaration_required"),
      item("nfse_municipal", "conditional", 80, "service_provider"),
      item("mei_revenue_support", "required", 90),
      item("mei_status_limit_review", "required", 100),
      item("destda", "conditional", 110, "state_registration_or_required"),
    ],
  },
  {
    taxRegimeCode: "simples_nacional",
    name: "Simples Nacional - Carga Padrao",
    items: [
      item("pgdas_d", "required", 10),
      item("defis", "required", 20),
      item("dctfweb_mit", "conditional", 30, "has_employees_or_retentions"),
      item("esocial", "conditional", 40, "has_employees"),
      item("fgts", "conditional", 50, "has_employees"),
      item("efd_reinf", "conditional", 60, "retentions_or_services"),
      item("iss_municipal", "conditional", 70, "service_provider"),
      item("municipal_service_tax_return", "conditional", 80, "municipal_service_declaration_required"),
      item("nfse_municipal", "conditional", 90, "service_provider"),
      item("efd_icms_ipi", "conditional", 100, "icms_ipi_taxpayer"),
      item("destda", "conditional", 110, "icms_st_difal_anticipation"),
      item("das_complementar_review", "conditional", 120, "tax_benefit_or_incentive_usage"),
      item("simples_option_status_review", "required", 130),
      item("generic_state_obligations", "conditional", 140, "state_registration"),
      item("generic_municipal_obligations", "conditional", 150, "municipal_service_declaration_required"),
    ],
  },
  {
    taxRegimeCode: "lucro_presumido",
    name: "Lucro Presumido - Carga Padrao",
    items: [
      item("dctfweb_mit", "required", 10),
      item("efd_reinf", "required", 20),
      item("esocial", "conditional", 30, "has_employees"),
      item("fgts", "conditional", 40, "has_employees"),
      item("efd_contribuicoes", "conditional", 50, "efd_contribuicoes_applicable"),
      item("efd_icms_ipi", "conditional", 60, "icms_ipi_taxpayer"),
      item("iss_municipal", "conditional", 70, "service_provider"),
      item("municipal_service_tax_return", "conditional", 80, "municipal_service_declaration_required"),
      item("ecd", "conditional", 90, "ecd_applicable"),
      item("ecf", "required", 100),
      item("irpj_csll_presumido", "required", 110),
      item("pis_cofins_cumulativo", "required", 120),
      item("dirbi", "conditional", 130, "tax_benefit_or_incentive_usage"),
      item("generic_state_obligations", "conditional", 140, "state_registration"),
      item("generic_municipal_obligations", "conditional", 150, "municipal_service_declaration_required"),
    ],
  },
  {
    taxRegimeCode: "lucro_real",
    name: "Lucro Real - Carga Padrao",
    items: [
      item("dctfweb_mit", "required", 10),
      item("efd_reinf", "required", 20),
      item("esocial", "conditional", 30, "has_employees"),
      item("fgts", "conditional", 40, "has_employees"),
      item("efd_contribuicoes", "required", 50),
      item("efd_icms_ipi", "conditional", 60, "icms_ipi_taxpayer"),
      item("iss_municipal", "conditional", 70, "service_provider"),
      item("municipal_service_tax_return", "conditional", 80, "municipal_service_declaration_required"),
      item("ecd", "required", 90),
      item("ecf", "required", 100),
      item("irpj_csll_lucro_real", "required", 110),
      item("pis_cofins_nao_cumulativo", "required", 120),
      item("dirbi", "conditional", 130, "tax_benefit_or_incentive_usage"),
      item("generic_state_obligations", "conditional", 140, "state_registration"),
      item("generic_municipal_obligations", "conditional", 150, "municipal_service_declaration_required"),
    ],
  },
];

export function getBaselineLoadByRegime(taxRegimeCode: TaxRegimeCode): BaselineRegimeLoad | null {
  return baselineRegimeLoads.find((load) => load.taxRegimeCode === taxRegimeCode) ?? null;
}

function master(
  code: string,
  name: string,
  sector: BaselineMasterObligation["sector"],
  periodicity: BaselineMasterObligation["periodicity"],
  dueDay: number,
  requiresDocument: boolean,
  yearlyDueMonth: number | null = null,
): BaselineMasterObligation {
  return {
    code,
    name,
    sector,
    periodicity,
    due_day: dueDay,
    yearly_due_month: yearlyDueMonth,
    competence_reference: periodicity === "yearly" ? "vigente" : "anterior",
    technical_due_month_reference: "vigente",
    priority: "media",
    requires_document: requiresDocument,
  };
}

function item(
  templateCode: string,
  applicability: RegimeLoadApplicability,
  sortOrder: number,
  conditionKey?: RegimeLoadConditionKey,
): BaselineRegimeLoadItem {
  return { templateCode, applicability, sortOrder, conditionKey };
}
