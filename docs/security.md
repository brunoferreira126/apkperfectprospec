# Segurança

## Controles implementados na fundação

- nenhum segredo usa prefixo `VITE_` ou entra no bundle público;
- cookies de sessão `HttpOnly`, `Secure` e `SameSite=Strict`;
- assinatura HMAC com comparação resistente a timing;
- senha com `scrypt` e salt;
- autorização por papel nas Functions;
- verificação de origem em ações autenticadas que alteram sessão;
- limite de 4 KB no payload de login e limite de 256 caracteres para senha;
- rate limit inicial de login;
- timeout nas chamadas ao Google;
- erros públicos sem stack trace;
- cabeçalhos CSP, anti-frame, anti-sniff, Referrer Policy e Permissions Policy;
- logs de auditoria removem campos que pareçam segredo;
- source maps desligados na build de produção.

## Riscos e mitigação planejada

1. **Rate limit em memória:** Functions podem ter várias instâncias. Antes de abrir o sistema para mais usuários, mover o contador para um armazenamento distribuído ou serviço de edge rate limiting.
2. **Revogação de sessão:** a sessão atual é stateless. Para revogação imediata, incluir `sessionVersion` ou denylist persistida.
3. **Google Drive como banco:** listagens em muitos arquivos não escalam. A V1 prioriza validação do processo; migrar para Postgres quando volume/concorrência crescerem.
4. **Concorrência:** atualização simultânea pode sobrescrever versões. A Etapa 2 deverá usar versão/ETag ou controle otimista.
5. **OAuth do Drive:** usar uma conta dedicada, escopo mínimo e acesso somente à pasta do produto; rotacionar credenciais em caso de suspeita.
6. **Auditoria em console:** encaminhar logs da Netlify para armazenamento com retenção e acesso restrito antes da operação regular.
7. **LGPD:** estabelecer prazo de retenção, processo de correção/exportação/exclusão e base legal antes de ampliar coleta.
8. **Operações em dois arquivos:** lead e histórico são persistidos separadamente no Drive, que não oferece transação entre arquivos. A criação possui compensação; atualizações usam versão otimista e devem ganhar uma rotina de reconciliação antes de alto volume.
9. **Prompt injection nos dados do lead:** campos comerciais são enviados como JSON delimitado e tratados explicitamente como dados, não instruções. O resultado ainda passa por schema e validação independente.
10. **Custo e abuso da IA:** análises exigem usuário autorizado, origem válida e rate limit. Antes de ampliar a equipe, mover esse limite para armazenamento distribuído e criar orçamento/alertas do provedor.
11. **Privacidade no provedor:** a integração envia somente os campos comerciais necessários e usa `store: false`. A política contratual e a retenção do provedor devem ser revisadas antes da produção.

## Checklist antes de produção

- definir `SESSION_SECRET` aleatório com no mínimo 32 caracteres;
- gerar e configurar `ADMIN_PASSWORD_HASH`;
- configurar variáveis no painel da Netlify, nunca em arquivo commitado;
- restringir e testar a conta/pasta do Google Drive;
- confirmar HTTPS e domínios autorizados;
- testar login, logout, expiração, acesso direto a `/app/*`, papéis e payloads inválidos;
- revisar logs para garantir ausência de dados sensíveis.
