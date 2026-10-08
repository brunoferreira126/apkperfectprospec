# Arquitetura técnica da V1

## Decisão

A V1 usa React + Vite no frontend e Netlify Functions no backend. O navegador conversa apenas com `/api/*`; credenciais do Google Drive e da futura LLM existem exclusivamente como variáveis do ambiente das Functions.

```text
Navegador
  └─ HTTPS /api
      └─ Netlify Functions
          ├─ autenticação e autorização
          ├─ validação, rate limit e auditoria
          ├─ casos de uso (etapas seguintes)
          └─ interfaces Repository
              └─ implementação Google Drive
```

## Estrutura

- `src/`: interface, navegação, páginas e estado de sessão.
- `netlify/functions/`: endpoints públicos do backend. Todo endpoint de negócio deverá chamar `authorize`.
- `netlify/edge-functions/`: barreira de acesso às rotas `/app/*` na borda.
- `server/auth/`: sessão assinada, verificação de senha e papéis.
- `server/repositories/`: contratos independentes do armazenamento.
- `server/drive/`: cliente e implementações específicas do Google Drive.
- `server/audit/`: eventos estruturados sem segredos.
- `docs/`: decisões, segurança e modelo de dados.

## Autenticação

- Conta inicial ADMIN configurada por `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH`.
- Senha armazenada como hash `scrypt` com salt; senha em texto nunca é persistida.
- Sessão assinada com HMAC-SHA256 e validade de 8 horas em cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- A Edge Function impede acesso anônimo às URLs `/app/*`.
- Cada Function sensível valida novamente a sessão e o papel. A proteção visual não é considerada autorização.

Papéis preparados: `ADMIN`, `COMMERCIAL` e `VIEWER`.

## Google Drive

O OAuth usa refresh token apenas no backend e solicita tokens de acesso com timeout. A pasta indicada por `GOOGLE_DRIVE_FOLDER_ID` é a raiz `/Perfect Prospect`.

`ensureDriveStructure` cria de forma idempotente:

```text
database/leads
database/interactions
database/opportunities
database/searches
reports
exports
backups
logs
```

Cada lead é um JSON separado. As regras de negócio dependem de `LeadRepository`, nunca de `DriveClient`. Uma futura implementação `PostgresLeadRepository` poderá substituir a atual sem alterar interface ou casos de uso.

## Fluxo das Functions

1. Netlify recebe HTTPS e aplica cabeçalhos de segurança.
2. A Function limita método e tamanho do payload.
3. Autenticação e papel são validados no servidor.
4. Dados são validados antes do caso de uso.
5. O caso de uso acessa uma interface Repository.
6. Eventos relevantes são auditados com metadados mínimos.
7. A resposta pública usa erro estável, sem stack trace ou credenciais.

## Etapas seguintes

1. Fundação — implementada.
2. Leads — implementada: CRUD, filtros, detalhes, histórico e Drive Repository em uso.
3. IA — implementada: JSON estruturado validado no servidor, score e abordagem.
4. Comercial — aprovação, CRM, follow-up, ganho/perda e valores.
5. Dashboard — métricas calculadas dos dados reais.
6. Busca — implementada com OpenStreetMap/Overpass como fonte gratuita, filtros por região e segmento, score preliminar, deduplicação e importação somente após seleção humana. Google Places permanece como adaptador opcional.

## Busca de oportunidades

O navegador envia apenas cidades e segmentos permitidos para `/api/search-leads`. A Function valida sessão, origem e rate limit antes de consultar o OpenStreetMap pela API Overpass. Uma consulta por município pode retornar vários estabelecimentos, reduzindo a carga sobre a fonte pública.

Os resultados são ordenados por sinais públicos verificáveis, como contato disponível e oportunidade digital. Esse score é preliminar e não substitui a análise estruturada por IA. O endpoint `/api/import-search-leads` valida novamente os dados, evita duplicatas pelo identificador da fonte e cria leads somente depois da seleção explícita do usuário.

## Motor de IA

As regras dependem de `LLMProvider`; o primeiro adaptador é `OpenAIResponsesProvider`. Modelo, chave e endpoint são configuração exclusiva do backend. A chamada utiliza Structured Outputs, não persiste a resposta no provedor (`store: false`) e tem timeout.

O modelo propõe os quatro critérios, mas o backend valida cada limite e recalcula o total. A oferta recomendada precisa existir na configuração ativa. Uma saída inválida, recusa ou timeout não altera o lead.

A análise não altera automaticamente o status do lead e a mensagem gerada é salva apenas como rascunho.
