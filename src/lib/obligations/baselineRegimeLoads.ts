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
  master("pgdas_d", "PGDAS-D", "Fiscal", "monthly", 20, true),
  master("defis", "DEFIS", "Fiscal", "yearly", 31, true),
  master("dasn_simei", "DASN-SIMEI", "Fiscal", "yearly", 31, true),
  master("pgmei", "PGMEI/DAS MEI", "Fiscal", "monthly", 20, true),
  master("dctf_mensal", "DCTF Mensal", "Fiscal", "monthly", 15, true),
  master("efd_contribuicoes", "EFD-Contribuicoes", "Fiscal", "monthly", 15, true),
  master("efd_icms_ipi", "EFD ICMS/IPI", "Fiscal", "monthly", 20, true),
  master("ecd", "ECD", "Contabil", "yearly", 31, true),
  master("ecf", "ECF", "Contabil", "yearly", 31, true),
  master("iss_municipal", "ISS Municipal", "Fiscal", "monthly", 10, true),
];

export const baselineRegimeLoads: BaselineRegimeLoad[] = [
  {
    taxRegimeCode: "simples_nacional",
    name: "Simples Nacional - Carga Padrao",
    items: [
      item("pgdas_d", "required", 10),
      item("defis", "required", 20),
      item("fgts", "conditional", 30, "has_employees"),
      item("esocial", "conditional", 40, "has_employees"),
      item("dctfweb_mit", "conditional", 50, "has_employees"),
      item("iss_municipal", "conditional", 60, "iss_applicable"),
    ],
  },
  {
    taxRegimeCode: "lucro_presumido",
    name: "Lucro Presumido - Carga Padrao",
    items: [
      item("dctf_mensal", "required", 10),
      item("dctfweb_mit", "required", 20),
      item("efd_reinf", "required", 30),
      item("ecd", "required", 40),
      item("ecf", "required", 50),
      item("efd_contribuicoes", "conditional", 60, "service_provider"),
      item("efd_icms_ipi", "conditional", 70, "icms_taxpayer"),
      item("fgts", "conditional", 80, "has_employees"),
      item("esocial", "conditional", 90, "has_employees"),
      item("iss_municipal", "conditional", 100, "iss_applicable"),
    ],
  },
  {
    taxRegimeCode: "lucro_real",
    name: "Lucro Real - Carga Padrao",
    items: [
      item("dctf_mensal", "required", 10),
      item("dctfweb_mit", "required", 20),
      item("efd_reinf", "required", 30),
      item("ecd", "required", 40),
      item("ecf", "required", 50),
      item("efd_contribuicoes", "required", 60),
      item("efd_icms_ipi", "conditional", 70, "icms_taxpayer"),
      item("fgts", "conditional", 80, "has_employees"),
      item("esocial", "conditional", 90, "has_employees"),
      item("iss_municipal", "conditional", 100, "iss_applicable"),
    ],
  },
  {
    taxRegimeCode: "mei",
    name: "MEI - Carga Padrao",
    items: [
      item("pgmei", "required", 10),
      item("dasn_simei", "required", 20),
      item("fgts", "conditional", 30, "has_employees"),
      item("esocial", "conditional", 40, "has_employees"),
      item("iss_municipal", "conditional", 50, "iss_applicable"),
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
