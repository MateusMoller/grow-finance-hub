# Quickstart: Pipeline de Vendas Comercial

## Preconditions

- Usuario interno autenticado.
- Usuario com acesso ao modulo Vendas.
- Organizacao ativa resolvida.
- Banco com migrations aplicadas e tipos Supabase atualizados.

## Validation Flow

1. Acessar `/app/crm` e confirmar que o modulo aparece como "Vendas".
2. Criar uma oportunidade para cliente existente.
3. Criar uma oportunidade para cliente novo/lead comercial.
4. Criar uma oportunidade de produto avulso do tipo automacao, consultoria ou sistema.
5. Criar uma oportunidade usando a opcao "Outro" e confirmar que ela nao cria item novo no catalogo.
6. Como administrador/gestor, criar, ordenar e inativar uma etapa do pipeline.
7. Como administrador/gestor, criar, editar e inativar um item do catalogo comercial.
8. Movimentar oportunidades por etapas do pipeline.
9. Registrar atividade e proximo follow-up em uma oportunidade.
10. Alterar valor, responsavel e previsao; confirmar historico.
11. Marcar uma oportunidade de cliente existente como ganha.
12. Marcar uma oportunidade de cliente novo como ganha e confirmar cliente pendente no modulo Clientes.
13. Confirmar que a oportunidade ganha de cliente novo gerou uma tarefa de complementacao de cadastro para o setor Comercial, sem responsavel obrigatorio.
14. Marcar outra oportunidade como perdida com motivo.
15. Filtrar por responsavel, etapa, status, periodo, cliente e tipo de venda.
16. Validar indicadores de pipeline apos filtros.
17. Testar usuario sem permissao de Vendas e confirmar bloqueio.
18. Testar usuario comercial sem permissao de gestao e confirmar bloqueio para gerenciar etapas e catalogo.

## Quality Gates

Run before delivery:

```powershell
npm run lint
npm run test
npm run build
```

## Manual UX Review

- Pipeline deve usar largura da tela de forma eficiente.
- Cards devem exibir cliente/lead, tipo de venda, valor, etapa, responsavel e proximo passo sem poluicao.
- Formulario deve permitir cliente existente ou cliente novo sem confundir o usuario.
- Formulario deve permitir catalogo padrao e opcao "Outro" sem poluir o cadastro.
- Detalhe da oportunidade deve deixar historico e atividades acessiveis.
- Indicadores devem refletir filtros ativos.
