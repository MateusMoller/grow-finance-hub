import type { RegimeLoadApplicability, RegimeLoadConditionKey, TaxRegimeCode } from "./regimeLoadTypes";

export interface BaselineMasterObligation {
  code: string;
  name: string;
  sector: "Fiscal" | "Contabil" | "Departamento Pessoal";
  periodicity: "monthly" | "quarterly" | "yearly" | "custom";
  due_day: number;
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

export const baselineMasterObligations: BaselineMasterObligation[] = [
  master("fgts", "FGTS", "Departamento Pessoal", "monthly", 20, true),
  master("esocial", "eSocial", "Departamento Pessoal", "monthly", 15, true),
  master("dctfweb_mit", "DCTFWeb/MIT", "Fiscal", "monthly", 25, true),
  master("efd_reinf", "EFD-Reinf", "Fiscal", "monthly", 15, true),
  master("payroll_closing", "Fechamento de folha e holerites", "Departamento Pessoal", "monthly", 25, true),
  master("inss_contribution_review", "Revisao de INSS e terceiros", "Departamento Pessoal", "monthly", 20, true),
  master("iss_municipal", "ISS Municipal", "Fiscal", "monthly", 10, true),
  master("icms_state_routine", "Rotina estadual ICMS", "Fiscal", "monthly", 20, true),
  master("tax_regularidade_review", "Revisao de certidoes e regularidade fiscal", "Fiscal", "monthly", 25, true),
  master("client_document_checklist", "Checklist de documentos do cliente", "Contabil", "monthly", 5, true),
  master("accounting_monthly_closing", "Fechamento contabil mensal", "Contabil", "monthly", 20, true),
  master("annual_cadastral_fiscal_review", "Revisao cadastral e fiscal anual", "Fiscal", "yearly", 31, true),
  master("pgdas_d", "PGDAS-D", "Fiscal", "monthly", 20, true),
  master("defis", "DEFIS", "Fiscal", "yearly", 31, true),
  master("das_complementar_review", "Revisao de DAS complementar e ajustes", "Fiscal", "monthly", 20, true),
  master("simples_option_status_review", "Revisao anual da opcao pelo Simples Nacional", "Fiscal", "yearly", 31, true),
  master("dasn_simei", "DASN-SIMEI", "Fiscal", "yearly", 31, true),
  master("pgmei", "PGMEI/DAS MEI", "Fiscal", "monthly", 20, true),
  master("mei_revenue_support", "Controle de receita bruta MEI", "Fiscal", "monthly", 20, true),
  master("mei_status_limit_review", "Revisao anual de limite e status MEI", "Fiscal", "yearly", 31, true),
  master("mei_migration_alert", "Alerta de desenquadramento MEI", "Fiscal", "monthly", 20, true),
  master("irpj_csll_presumido", "IRPJ/CSLL Lucro Presumido", "Fiscal", "quarterly", 31, true),
  master("pis_cofins_cumulativo", "PIS/COFINS cumulativo", "Fiscal", "monthly", 25, true),
  master("dctf_mensal", "DCTF Mensal", "Fiscal", "monthly", 15, true),
  master("efd_contribuicoes", "EFD-Contribuicoes", "Fiscal", "monthly", 15, true),
  master("efd_icms_ipi", "EFD ICMS/IPI", "Fiscal", "monthly", 20, true),
  master("ecd", "ECD", "Contabil", "yearly", 31, true),
  master("ecf", "ECF", "Contabil", "yearly", 31, true),
  master("tax_withholding_review", "Revisao de retencoes IRRF/CSRF/INSS/ISS", "Fiscal", "monthly", 20, true),
  master("irpj_csll_lucro_real", "IRPJ/CSLL Lucro Real", "Fiscal", "monthly", 31, true),
  master("pis_cofins_nao_cumulativo", "PIS/COFINS nao cumulativo", "Fiscal", "monthly", 25, true),
  master("lalur_lacs_review", "Revisao Lalur/Lacs e ajustes fiscais", "Contabil", "monthly", 31, true),
];

export const baselineRegimeLoads: BaselineRegimeLoad[] = [
  {
    taxRegimeCode: "simples_nacional",
    name: "Simples Nacional - Carga Padrao",
    items: [
      item("pgdas_d", "required", 10),
      item("defis", "required", 20),
      item("das_complementar_review", "conditional", 30, "service_provider"),
      item("iss_municipal", "conditional", 40, "iss_applicable"),
      item("icms_state_routine", "conditional", 50, "icms_taxpayer"),
      item("fgts", "conditional", 60, "has_employees"),
      item("esocial", "conditional", 70, "has_employees"),
      item("dctfweb_mit", "conditional", 80, "has_employees"),
      item("payroll_closing", "conditional", 90, "has_employees"),
      item("efd_reinf", "conditional", 100, "service_provider"),
      item("accounting_monthly_closing", "conditional", 110, "accounting_contracted"),
      item("tax_regularidade_review", "required", 120),
      item("client_document_checklist", "required", 130),
      item("annual_cadastral_fiscal_review", "required", 140),
      item("simples_option_status_review", "required", 150),
    ],
  },
  {
    taxRegimeCode: "lucro_presumido",
    name: "Lucro Presumido - Carga Padrao",
    items: [
      item("irpj_csll_presumido", "required", 10),
      item("pis_cofins_cumulativo", "required", 20),
      item("dctfweb_mit", "required", 30),
      item("dctf_mensal", "required", 40),
      item("efd_reinf", "conditional", 50, "service_provider"),
      item("ecf", "required", 60),
      item("ecd", "conditional", 70, "accounting_contracted"),
      item("efd_contribuicoes", "conditional", 80, "service_provider"),
      item("efd_icms_ipi", "conditional", 90, "icms_taxpayer"),
      item("iss_municipal", "conditional", 100, "iss_applicable"),
      item("fgts", "conditional", 110, "has_employees"),
      item("esocial", "conditional", 120, "has_employees"),
      item("payroll_closing", "conditional", 130, "has_employees"),
      item("inss_contribution_review", "conditional", 140, "has_employees"),
      item("tax_withholding_review", "conditional", 150, "service_provider"),
      item("tax_regularidade_review", "required", 160),
      item("client_document_checklist", "required", 170),
      item("accounting_monthly_closing", "required", 180),
      item("annual_cadastral_fiscal_review", "required", 190),
    ],
  },
  {
    taxRegimeCode: "lucro_real",
    name: "Lucro Real - Carga Padrao",
    items: [
      item("irpj_csll_lucro_real", "required", 10),
      item("pis_cofins_nao_cumulativo", "required", 20),
      item("dctfweb_mit", "required", 30),
      item("dctf_mensal", "required", 40),
      item("efd_contribuicoes", "required", 50),
      item("ecd", "required", 60),
      item("ecf", "required", 70),
      item("efd_reinf", "conditional", 80, "service_provider"),
      item("efd_icms_ipi", "conditional", 90, "icms_taxpayer"),
      item("iss_municipal", "conditional", 100, "iss_applicable"),
      item("fgts", "conditional", 110, "has_employees"),
      item("esocial", "conditional", 120, "has_employees"),
      item("payroll_closing", "conditional", 130, "has_employees"),
      item("inss_contribution_review", "conditional", 140, "has_employees"),
      item("tax_withholding_review", "conditional", 150, "service_provider"),
      item("lalur_lacs_review", "required", 160),
      item("tax_regularidade_review", "required", 170),
      item("client_document_checklist", "required", 180),
      item("accounting_monthly_closing", "required", 190),
      item("annual_cadastral_fiscal_review", "required", 200),
    ],
  },
  {
    taxRegimeCode: "mei",
    name: "MEI - Carga Padrao",
    items: [
      item("pgmei", "required", 10),
      item("dasn_simei", "required", 20),
      item("mei_revenue_support", "required", 30),
      item("iss_municipal", "conditional", 40, "iss_applicable"),
      item("mei_status_limit_review", "required", 50),
      item("fgts", "conditional", 60, "has_employees"),
      item("esocial", "conditional", 70, "has_employees"),
      item("payroll_closing", "conditional", 80, "has_employees"),
      item("mei_migration_alert", "optional", 90),
      item("client_document_checklist", "required", 100),
      item("annual_cadastral_fiscal_review", "required", 110),
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
): BaselineMasterObligation {
  return {
    code,
    name,
    sector,
    periodicity,
    due_day: dueDay,
    competence_reference: "anterior",
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
