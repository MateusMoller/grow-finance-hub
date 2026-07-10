# Fiscal Obligation Baseline 2026

Levantamento inicial para cadastro das cargas padrao por tributacao no modulo nativo Grow de obrigacoes.

## Fontes consultadas

- PGDAS-D: Gov.br informa prazo mensal ate dia 20 do mes seguinte ao periodo de apuracao.
- DCTFWeb/MIT: Gov.br informa substituicao da DCTF PGD pelo MIT/DCTFWeb a partir de 01/01/2025 e prazo mensal ate o ultimo dia util do mes seguinte.
- EFD-Reinf e EFD-Contribuicoes: Agenda Tributaria da Receita de 15/06/2026 lista EFD-Reinf de maio/2026 e EFD-Contribuicoes de abril/2026 no dia 15.
- DEFIS: Simples Nacional informa prazo ate 31 de marco do ano-calendario subsequente.
- DASN-SIMEI: Gov.br informa prazo ate 31 de maio de cada ano, relativa ao ano anterior.
- ECD: Gov.br informa regra geral ate o ultimo dia util de junho do ano subsequente.
- ECF: Gov.br informa regra geral ate o ultimo dia util de julho do ano subsequente.

## Premissas cadastradas

O modelo atual guarda dia e mes de referencia, mas ainda nao calcula "ultimo dia util". Para DCTFWeb/MIT, ECD e ECF, foi cadastrado dia 31/30 como prazo operacional, com observacao de "ultimo dia util" em `operational_notes`.

Obrigacoes estaduais e municipais variam por UF, inscricao estadual, atividade, municipio e sistema local. Por isso, EFD ICMS/IPI, DeSTDA, ISS e declaracoes municipais foram cadastradas como condicionais e com prazo operacional revisavel por cliente.

## Cargas por tributacao

### Simples Nacional

- PGDAS-D: mensal, dia 20.
- DEFIS: anual, 31/03.
- Revisao de DAS complementar e ajustes: mensal, condicional para prestadores.
- ISS Municipal e declaracao municipal de servicos: mensais, condicionais quando houver ISS.
- Rotina estadual ICMS e DeSTDA: mensais, condicionais quando houver ICMS/IE.
- FGTS, eSocial, DCTFWeb/MIT e fechamento de folha: mensais, condicionais quando houver empregados.
- EFD-Reinf: mensal, condicional para prestadores/tomadores sujeitos a retencoes.
- Fechamento contabil mensal: condicional quando contratado.
- Regularidade fiscal, checklist documental, revisao cadastral/fiscal anual e revisao da opcao pelo Simples: controles internos obrigatorios.

### Lucro Presumido

- IRPJ/CSLL Lucro Presumido: trimestral.
- PIS/COFINS cumulativo: mensal.
- DCTFWeb/MIT: mensal, ultimo dia util do mes seguinte.
- EFD-Reinf: mensal, condicional para retencoes/servicos.
- ECF: anual, ultimo dia util de julho.
- ECD: anual, condicional conforme obrigatoriedade/contratacao contabil.
- EFD-Contribuicoes: mensal, condicional conforme perfil fiscal.
- EFD ICMS/IPI: mensal, condicional para contribuinte ICMS.
- ISS Municipal e declaracao municipal de servicos: mensais, condicionais quando houver ISS.
- FGTS, eSocial, fechamento de folha e revisao de INSS: condicionais quando houver empregados.
- Revisao de retencoes, regularidade fiscal, checklist documental, fechamento contabil e revisao cadastral anual.

### Lucro Real

- IRPJ/CSLL Lucro Real: mensal.
- PIS/COFINS nao cumulativo: mensal.
- DCTFWeb/MIT: mensal, ultimo dia util do mes seguinte.
- EFD-Contribuicoes: mensal.
- ECD: anual, ultimo dia util de junho.
- ECF: anual, ultimo dia util de julho.
- EFD-Reinf: mensal, condicional para retencoes/servicos.
- EFD ICMS/IPI: mensal, condicional para contribuinte ICMS.
- ISS Municipal e declaracao municipal de servicos: mensais, condicionais quando houver ISS.
- FGTS, eSocial, fechamento de folha e revisao de INSS: condicionais quando houver empregados.
- Revisao de retencoes, Lalur/Lacs, regularidade fiscal, checklist documental, fechamento contabil e revisao cadastral anual.

### MEI

- PGMEI/DAS MEI: mensal, dia 20.
- DASN-SIMEI: anual, 31/05.
- Controle de receita bruta MEI: mensal.
- ISS Municipal e declaracao municipal de servicos: condicionais quando houver ISS/municipio exigir.
- Revisao anual de limite e status MEI.
- FGTS, eSocial, DCTFWeb/MIT e fechamento de folha: condicionais quando houver empregado.
- Alerta de desenquadramento: opcional.
- Checklist documental e revisao cadastral/fiscal anual.
