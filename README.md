# Perfect Prospect

Assistente interno de prospecção comercial da Perfect Evolution.

## Etapas concluídas

**Etapa 1 — Fundação:** frontend responsivo, rotas protegidas, autenticação e autorização no backend, contratos de repositories, integração isolada com Google Drive, auditoria básica e configuração segura por variáveis de ambiente.

**Etapa 2 — Leads:** cadastro manual, listagem, filtros, detalhes, edição, status, exclusão administrativa, histórico append-only e controle de versão contra sobrescritas concorrentes.

**Etapa 3 — IA:** análise estruturada, score validado, problema e oportunidade, recomendação entre ofertas ativas e geração de abordagem personalizada sem envio automático.

**Busca multissegmento:** pesquisa real e gratuita em Cascavel, Pindoretama, Aquiraz e Eusébio por meio do OpenStreetMap/Overpass, score preliminar, seleção humana e importação em lote com deduplicação. Google Places permanece como provedor opcional futuro.

As telas das etapas futuras aparecem apenas como destinos planejados. Nenhuma ação falsa, scraping ou disparo automático foi implementado.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha os valores.
   A busca piloto usa OpenStreetMap e não exige chave nem faturamento. `GOOGLE_PLACES_API_KEY` fica disponível apenas para uma futura fonte premium.
2. Gere o hash da senha: `npm run password:hash -- "sua-senha-forte"`.
3. Instale as dependências: `npm install`.
4. Rode frontend e Functions: `npm run dev`.
5. Acesse a URL exibida pelo Netlify Dev.

## Validar

```bash
npm run check
```

## Publicar com GitHub, Netlify e Google Drive

O repositório não deve conter `.env`, tokens, hashes reais, dados locais nem a pasta `.netlify`. O Netlify executa `npm run build`, publica `dist/` e disponibiliza as Functions de `netlify/functions/`.

Em produção, configure no Netlify:

- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `STORAGE_PROVIDER=drive`
- `GOOGLE_DRIVE_FOLDER_ID`

Para conectar o Drive, escolha uma das opções:

- ponte gratuita do Apps Script: `GOOGLE_APPS_SCRIPT_URL` e `GOOGLE_APPS_SCRIPT_SECRET`;
- OAuth direto: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REFRESH_TOKEN`.

`GOOGLE_PLACES_API_KEY` e as variáveis `LLM_*` são opcionais. A busca gratuita usa OpenStreetMap, e a pré-qualificação local não depende de uma API de IA.

O roteiro completo de entrega está em [docs/deployment.md](docs/deployment.md).

Leia [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md) e [docs/data-model.md](docs/data-model.md) antes da Etapa 2.
