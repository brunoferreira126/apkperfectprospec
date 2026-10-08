# Modelo de dados inicial

## Lead

O contrato base está em `server/repositories/LeadRepository.ts`. Cada registro possui UUID, versão monotônica, dados comerciais mínimos, status e timestamps ISO-8601. Score e análise serão adicionados na etapa correspondente, com validação de schema antes de persistir.

Atualizações exigem `expectedVersion`. Se outra sessão já tiver alterado o registro, o backend responde com conflito em vez de sobrescrever silenciosamente.

A análise acrescenta `score`, `scoreBreakdown`, `analysis`, `generatedMessage` e seus timestamps. O total não é aceito da IA: é sempre calculado no servidor a partir dos quatro componentes validados.

## Histórico

Interações são registros append-only ligados por `leadId`. Mudanças importantes não devem substituir eventos anteriores.

## Oportunidade

Registra estado `open`, `won` ou `lost`, valor de projeto e mensalidade quando aplicável. Dashboard e relatórios deverão agregar esses registros reais.

## Nomes físicos no Drive

- `database/leads/{leadId}.json`
- `database/interactions/{interactionId}.json`
- `database/opportunities/{opportunityId}.json`
- `database/searches/{searchId}.json`

O nome e a organização de arquivos são detalhes do `DriveRepository`; componentes e casos de uso não podem depender deles.
