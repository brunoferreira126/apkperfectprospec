# Entrega em produção

## Arquitetura publicada

```text
GitHub → build automático do Netlify
              ├─ React/Vite em HTTPS
              ├─ Netlify Functions em /api/*
              └─ Google Drive como armazenamento privado
```

O navegador nunca recebe credenciais do Google. Login, validação, busca, importação e acesso ao Drive passam pelas Functions autenticadas.

## 1. Google Drive

1. Crie uma pasta exclusiva chamada `Perfect Prospect` no Drive da conta usada pelo sistema.
2. No Google Cloud, habilite apenas a Google Drive API no projeto escolhido.
3. Configure a tela de consentimento OAuth e crie um cliente OAuth.
4. Gere um refresh token para a mesma conta que possui a pasta.
5. Guarde o ID da pasta, visível na URL depois de `folders/`.

Não salve client secret ou refresh token no GitHub. Como o Drive é usado como banco do piloto, a conta deve ter autenticação em duas etapas e a pasta não deve ser pública.

## 2. Variáveis do Netlify

Configure as variáveis abaixo para Functions e Edge Functions:

```text
SESSION_SECRET=<segredo aleatório com pelo menos 32 caracteres>
ADMIN_EMAIL=<e-mail de acesso>
ADMIN_PASSWORD_HASH=<hash gerado por npm run password:hash>
STORAGE_PROVIDER=drive
GOOGLE_CLIENT_ID=<cliente OAuth>
GOOGLE_CLIENT_SECRET=<segredo OAuth>
GOOGLE_REFRESH_TOKEN=<refresh token OAuth>
GOOGLE_DRIVE_FOLDER_ID=<id da pasta Perfect Prospect>
```

A busca gratuita não usa `GOOGLE_PLACES_API_KEY`. A análise local também não usa `LLM_API_KEY`; essas integrações só devem ser ativadas depois de definir orçamento.

## 3. GitHub e Netlify

1. Envie a branch `main` para um repositório privado no GitHub.
2. No Netlify, importe o repositório.
3. O `netlify.toml` já define build, pasta publicada, Functions, Edge Function, redirects e cabeçalhos.
4. Cadastre as variáveis antes do deploy de produção.
5. Execute o deploy e confirme `/api/health`.

## 4. Aceite

- abrir `/app` anonimamente redireciona para `/login`;
- login cria cookie seguro em HTTPS;
- busca retorna empresas reais do OpenStreetMap;
- aprovação cria lead com score, diagnóstico e mensagem;
- o lead aparece novamente após recarregar a página;
- `POST /api/drive-health`, autenticado como ADMIN, retorna `ok: true`;
- logout encerra a sessão;
- nenhum segredo aparece no bundle, nos commits ou nos logs.

## Observação do piloto

Google Drive é adequado para validar o processo com baixo volume e uma equipe pequena. Antes de aumentar concorrência ou volume, migre o repository para um banco transacional.
