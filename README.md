# Fluxary.ia

Aplicação responsiva de organização financeira pessoal, em português brasileiro. O projeto oferece lançamentos, categorias, contas, cartões, planejamento, metas, histórico mensal, chatbot financeiro, modo escuro e autenticação.

## Executar localmente

1. Instale Node.js 20.19+ ou 22.12+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha as credenciais públicas do seu projeto Supabase.
4. Configure `OPENAI_API_KEY` somente no ambiente do backend (Vercel ou `vercel env pull`).
5. Execute `vercel dev` para testar também a função Python `/api/chat`; `npm run dev` inicia apenas o frontend.

O acesso é exclusivo para contas autenticadas. Sem Supabase configurado, o login permanece indisponível e nenhuma funcionalidade financeira fica acessível.

## Configuração do Supabase

Para um projeto Supabase novo, execute uma única vez `BANCO_DE_DADOS_COMPLETO.sql` no SQL Editor. Esse script consolidado cria as tabelas, índices, restrições, triggers, permissões e políticas RLS sem exigir a execução dos arquivos da pasta `migrations`. `TESTES_BANCO_DE_DADOS.sql` contém verificações pós-instalação e um teste RLS transacional.

Para um projeto Supabase existente, aplique também `supabase/migrations/20261104000000_fluxary_ai_chat.sql` no SQL Editor para criar o histórico, políticas RLS e limites de uso do chat.

O frontend usa somente a URL do projeto e a chave pública `anon`/`publishable`. **Nunca** inclua a chave `service_role`, senha do banco ou outros segredos em variáveis `VITE_*`, no código do navegador ou no repositório. As políticas RLS do PostgreSQL isolam os registros por usuário.

Na Vercel, configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY`) e `OPENAI_API_KEY` nos ambientes Production e Preview. A chave OpenAI é secreta e usada somente pela função Python. O backend usa a sessão do usuário e a chave pública Supabase para consultar dados sob RLS; não requer `service_role`. Cada conta pode enviar até 5 mensagens por minuto e 20 por dia. O chatbot envia à OpenAI um resumo financeiro e até 30 movimentações recentes para gerar respostas.

## Persistência e dados existentes

Depois de preencher as variáveis do projeto Supabase e executar o esquema SQL, os dados financeiros são carregados e sincronizados com a conta autenticada no PostgreSQL hospedado. Sem essa configuração, o acesso permanece bloqueado. O app não oferece acesso como visitante e não usa `localStorage` como armazenamento financeiro. Dados locais antigos não são importados ou apagados automaticamente.

## Funcionalidades

- Cadastro, login, confirmação de e-mail, recuperação e troca de senha.
- Receitas, despesas e histórico mensal.
- Categorias, contas, cartões, compras parceladas e pagamento de fatura.
- Planejamento, orçamento mensal, metas e preferências da tela inicial.
- Chatbot financeiro com contexto das movimentações e histórico por usuário.
- Tema claro/escuro e navegação responsiva.

O esquema representa os recursos implementados hoje. Subcategorias, recorrências, transferências e favoritos não possuem telas nem operações no app atual e, por isso, não são tabelas incluídas como se já fossem funcionalidades disponíveis.

## Build

Execute `npm run build` para validar o TypeScript e gerar a aplicação em `dist/`.
