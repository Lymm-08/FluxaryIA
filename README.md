# Fluxary.ia

Aplicação responsiva de organização financeira pessoal, em português brasileiro. O projeto oferece lançamentos, categorias, contas, cartões, planejamento, metas, histórico mensal, chatbot financeiro, modo escuro e autenticação.

## Executar localmente

1. Instale Node.js 20.19+ ou 22.12+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha as credenciais públicas do seu projeto Supabase.
4. Configure `GEMINI_API_KEY` somente no ambiente do backend (Vercel ou `vercel env pull`).
5. Execute `vercel dev` para testar também a função Python `/api/chat`; `npm run dev` inicia apenas o frontend.

O acesso é exclusivo para contas autenticadas. Sem Supabase configurado, o login permanece indisponível e nenhuma funcionalidade financeira fica acessível.

## Configuração do Supabase

Para um projeto Supabase novo, execute uma única vez `BANCO_DE_DADOS_COMPLETO.sql` no SQL Editor. Esse script consolidado cria as tabelas, índices, restrições, triggers, permissões e políticas RLS sem exigir a execução dos arquivos da pasta `migrations`. `TESTES_BANCO_DE_DADOS.sql` contém verificações pós-instalação e um teste RLS transacional.

Para um projeto Supabase existente, aplique também `supabase/migrations/20261104000000_fluxary_ai_chat.sql` no SQL Editor para criar o histórico, políticas RLS e limites de uso do chat.

Para habilitar a solicitação e confirmação de exclusão de conta, aplique as migrações `supabase/migrations/20261104180000_confirm_fluxary_account_deletion.sql` e `supabase/migrations/20261104220000_fluxary_account_deletion_code.sql`, nesta ordem. Em projetos existentes que já aplicaram a primeira migração, aplique somente a segunda. As migrações criam códigos de uso único com validade de 30 minutos, bloqueiam o código após 5 tentativas incorretas, limitam solicitações e permitem a limpeza segura dos dados durante a exclusão no Supabase Auth. Links de confirmação enviados antes da atualização continuam aceitos até expirarem.

Para permitir excluir cofrinhos e contas bancárias preservando as movimentações, aplique `supabase/migrations/20261105183000_cash_box_history_preservation.sql` e depois `supabase/migrations/20261106090000_account_history_preservation.sql`. Em projetos existentes, aplique-as após as migrações de cofrinhos `20261103020000_cash_boxes.sql` e `20261103030000_cash_box_withdrawals.sql`. Em projetos novos instalados pelo script consolidado, aplique também essas duas migrações em ordem para habilitar a preservação no histórico.

O frontend usa somente a URL do projeto e a chave pública `anon`/`publishable`. **Nunca** inclua a chave `service_role`, senha do banco ou outros segredos em variáveis `VITE_*`, no código do navegador ou no repositório. As políticas RLS do PostgreSQL isolam os registros por usuário.

Na Vercel, acesse **Project → Settings → Environment Variables** e configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`) e `GEMINI_API_KEY` nos ambientes **Production** e **Preview**. Crie/consulte a chave em [Google AI Studio](https://aistudio.google.com/apikey). `GEMINI_API_KEY` é secreta, usada somente pela função Python e nunca deve ter prefixo `VITE_`. Configure também `AI_PROVIDER=gemini` e `GEMINI_MODEL=gemini-3.5-flash-lite`; o modelo Flash-Lite está disponível no nível gratuito segundo a tabela atual de preços do Gemini, sujeito aos limites de uso do projeto. Se sua conta ainda tiver acesso ao Gemini 2.5 Flash, pode selecionar `GEMINI_MODEL=gemini-2.5-flash`; o modelo está depreciado e o acesso está limitado a usuários existentes. Para voltar ao provedor anterior, configure `AI_PROVIDER=openai` e `OPENAI_API_KEY` no backend. O backend usa a sessão do usuário e a chave pública Supabase para consultar dados sob RLS; não requer `service_role`. Cada conta Fluxary pode enviar até 5 mensagens por minuto e 20 por dia. O chatbot envia ao provedor selecionado um resumo financeiro e até 30 movimentações recentes para gerar respostas.

Para o e-mail de exclusão, cadastre em **Project → Settings → Environment Variables** da Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. São variáveis somente de backend (sem prefixo `VITE_`); configure em **Production** e **Preview** e faça novo deploy após aplicar as migrações e salvar as variáveis. `SUPABASE_SERVICE_ROLE_KEY` é a chave administrativa secreta do projeto Supabase e nunca deve ser exposta no navegador. `RESEND_API_KEY` é criada no painel Resend. No Resend, verifique o domínio de envio e use em `RESEND_FROM_EMAIL` um remetente desse domínio, por exemplo `Fluxary <conta@seudominio.com>` (substitua pelo domínio que você verificou). O backend envia o código pela API oficial do Resend; não é necessário configurar SMTP no Supabase. Se o Resend retornar erro, a solicitação mostra falha e a conta permanece ativa. A aplicação atual não faz upload nem usa buckets de Storage; a exclusão também remove objetos cujo `owner_id` seja a conta.

## Persistência e dados existentes

Depois de preencher as variáveis do projeto Supabase e executar o esquema SQL, os dados financeiros são carregados e sincronizados com a conta autenticada no PostgreSQL hospedado. Sem essa configuração, o acesso permanece bloqueado. O app não oferece acesso como visitante e não usa `localStorage` como armazenamento financeiro. Dados locais antigos não são importados ou apagados automaticamente.

## Funcionalidades

- Cadastro, login, confirmação de e-mail, recuperação e troca de senha.
- Receitas, despesas e histórico mensal.
- Categorias, contas, cartões, compras parceladas e pagamento de fatura.
- Planejamento, orçamento mensal, metas e preferências da tela inicial.
- Chatbot financeiro com contexto das movimentações e histórico por usuário.
    - Cada conta pode enviar até 5 mensagens por minuto e 20 por dia.
    - Para responder, envia ao provedor escolhido um resumo financeiro e até 30 movimentações recentes.
    - O histórico do chat é mantido por usuário.
    -   Além dos limites do Fluxary, o uso do modelo está sujeito aos limites do provedor configurado.
- Tema claro/escuro e navegação responsiva.

O esquema representa os recursos implementados hoje. Subcategorias, recorrências, transferências e favoritos não possuem telas nem operações no app atual e, por isso, não são tabelas incluídas como se já fossem funcionalidades disponíveis.

## Build

Execute `npm run build` para validar o TypeScript e gerar a aplicação em `dist/`.
