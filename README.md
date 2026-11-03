# Fluxary.ia

Aplicação responsiva de organização financeira pessoal, em português brasileiro. O projeto oferece lançamentos, categorias, contas, cartões, planejamento, metas, histórico mensal, modo escuro e autenticação.

## Executar localmente

1. Instale Node.js 20.19+ ou 22.12+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha as credenciais públicas do seu projeto Supabase.
4. Execute `npm run dev`.

O acesso é exclusivo para contas autenticadas. Sem Supabase configurado, o login permanece indisponível e nenhuma funcionalidade financeira fica acessível.

## Configuração do Supabase

Siga o passo a passo em [CONFIGURACAO.md](./CONFIGURACAO.md). Para um projeto Supabase novo, execute uma única vez `BANCO_DE_DADOS_COMPLETO.sql` no SQL Editor. Esse script consolidado cria as tabelas, índices, restrições, triggers, permissões e políticas RLS sem exigir a execução dos arquivos da pasta `migrations`. `TESTES_BANCO_DE_DADOS.sql` contém verificações pós-instalação e um teste RLS transacional.

O frontend usa somente a URL do projeto e a chave pública `anon`/`publishable`. **Nunca** inclua a chave `service_role`, senha do banco ou outros segredos em variáveis `VITE_*`, no código do navegador ou no repositório. As políticas RLS do PostgreSQL isolam os registros por usuário.

## Persistência e dados existentes

Depois de preencher as variáveis do projeto Supabase e executar o esquema SQL, os dados financeiros são carregados e sincronizados com a conta autenticada no PostgreSQL hospedado. Sem essa configuração, o acesso permanece bloqueado. O app não oferece acesso como visitante e não usa `localStorage` como armazenamento financeiro. Dados locais antigos não são importados ou apagados automaticamente.

## Funcionalidades

- Cadastro, login, confirmação de e-mail, recuperação e troca de senha.
- Receitas, despesas e histórico mensal.
- Categorias, contas, cartões, compras parceladas e pagamento de fatura.
- Planejamento, orçamento mensal, metas e preferências da tela inicial.
- Tema claro/escuro e navegação responsiva.

O esquema representa os recursos implementados hoje. Subcategorias, recorrências, transferências e favoritos não possuem telas nem operações no app atual e, por isso, não são tabelas incluídas como se já fossem funcionalidades disponíveis.

## Build

Execute `npm run build` para validar o TypeScript e gerar a aplicação em `dist/`.
