# Configuração do Fluxary.ia

Este guia cobre as configurações externas necessárias para executar o Fluxary com login obrigatório e persistência Supabase. Nenhuma chave ou domínio real foi incluído no projeto.

## 1. Criar e configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com/) e guarde a senha do banco em um gerenciador seguro.
2. No **SQL Editor**, copie e execute uma única vez o conteúdo de [`BANCO_DE_DADOS_COMPLETO.sql`](./BANCO_DE_DADOS_COMPLETO.sql). Esse script consolidado cria todo o esquema; não é necessário executar os arquivos da pasta `migrations`.
3. Em **Project Settings → API Keys** (ou **Project Settings → API** em algumas versões do painel), copie:
   - **Project URL** para `VITE_SUPABASE_URL`.
   - A chave pública **publishable** para `VITE_SUPABASE_PUBLISHABLE_KEY` (ou a chave pública `anon` legada para `VITE_SUPABASE_ANON_KEY`).

O trigger de cadastro cria o perfil e as preferências. As tabelas financeiras têm RLS e cada política restringe as operações ao `auth.uid()` correspondente. Não desative RLS. O script foi preparado para um projeto novo; se você já executou um esquema anterior nesse projeto, confira as tabelas no Table Editor antes de rodá-lo.

O script cobre os dados usados pelas páginas atuais: `transactions` (receitas, despesas e compras/pagamentos parcelados), `categories`, `accounts`, `credit_cards`, `custom_banks`, `budgets`, `financial_goals` e `user_settings`, além de `profiles` ligado a `auth.users`. As movimentações e os orçamentos guardam o nome da categoria como histórico e também uma FK opcional `category_id`, anulada com segurança quando a categoria é removida. O controle atual de cartão calcula o valor em aberto a partir de compras e pagamentos; não existe ainda tela de ciclos/faturas individualizados. Subcategorias, recorrências, transferências e favoritos também não existem como operações/telas e não são anunciados como funcionalidades do banco.

## 2. Variáveis locais

1. Copie `.env.example` para `.env` na raiz do projeto.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores públicos copiados do Supabase. Se o projeto ainda usa a chave pública `anon` legada, ela pode ser configurada como `VITE_SUPABASE_ANON_KEY`.
3. Reinicie o servidor local com `npm run dev`.

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_ANON_KEY` são entregues ao navegador. Configure somente uma das chaves: prefira `VITE_SUPABASE_PUBLISHABLE_KEY`; `VITE_SUPABASE_ANON_KEY` é compatível com projetos que ainda usam a chave pública legada. A chave pública é segura para esse uso somente porque o banco aplica RLS. **Nunca** coloque `service_role`, senha do banco, tokens OAuth privados ou segredos em variáveis `VITE_*`.

O Fluxary não precisa de uma chave administrativa ou backend privado próprio: autenticação e operações de dados passam pelo Supabase com a sessão do usuário. Se futuramente forem adicionadas funções privilegiadas, elas devem ser implementadas no servidor/Edge Functions com segredos guardados no ambiente do servidor, nunca neste frontend.

## 3. Login, confirmação e recuperação

No Supabase, abra **Authentication → URL Configuration**:

- Configure **Site URL** com a URL principal de desenvolvimento ou produção.
- Para desenvolvimento local, adicione `http://localhost:5173/**` em **Redirect URLs**. Quando publicar sem domínio próprio, use o endereço temporário fornecido pela hospedagem como **Site URL** e adicione esse endereço em **Redirect URLs**. Não é preciso comprar domínio para autenticar ou usar o Supabase.
- Ative a confirmação de e-mail em **Authentication → Providers → Email** para exigir verificação antes do primeiro login.
- Revise os templates de confirmação e recuperação em **Authentication → Email Templates**.
- Revise e mantenha os limites de autenticação padrão em **Authentication → Rate Limits**. Não há CAPTCHA nem regras customizadas de tentativas implementados pelo frontend.
- Para envio confiável em produção, configure SMTP próprio na área de **Authentication → SMTP Settings**. O serviço padrão pode ter limites de entrega.

Se habilitar Google, configure o provedor em **Authentication → Providers → Google**, cadastre no Google Cloud a URL de callback exibida pelo Supabase e adicione no Supabase as URLs de redirecionamento do site. As credenciais OAuth privadas ficam nos painéis dos provedores, nunca no frontend.

## 4. Publicação na Vercel e domínio

1. Publique o repositório em um GitHub privado se quiser restringir quem pode ler o código-fonte; configure acesso e permissões diretamente no GitHub.
2. Importe o projeto em uma hospedagem para Vite, como Vercel, e use os comandos de build padrão: `npm run build` e diretório de saída `dist`. A hospedagem fornecerá uma URL temporária `*.vercel.app`; ela não precisa ser inventada ou comprada antecipadamente.
3. Em **Project Settings → Environment Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para Preview e Production (ou `VITE_SUPABASE_ANON_KEY` se estiver usando a chave pública legada). São valores públicos do projeto Supabase, não credenciais administrativas.
4. Faça o deploy e adicione o domínio em **Settings → Domains**. Configure no registrador os registros DNS exatamente como a Vercel indicar; HTTPS é provisionado pela hospedagem.
5. Inicialmente, defina **Site URL** e **Redirect URLs** usando localhost e a URL temporária real fornecida pela hospedagem. Quando comprar um domínio, adicione-o à hospedagem, configure o DNS conforme as instruções dela e acrescente o novo endereço HTTPS ao **Site URL** e às **Redirect URLs** do Supabase. Mantenha os redirects de desenvolvimento/preview necessários.
6. Faça novo deploy depois de mudar variáveis de ambiente.

O frontend não requer configuração CORS adicional para o fluxo padrão do Supabase. Não compartilhe senhas, chaves secretas ou acesso administrativo por este arquivo.

## 5. Itens que você precisa preencher

| Informação | Onde obter | Onde usar |
|---|---|---|
| URL do projeto Supabase | Supabase → Project Settings → API | `.env` local e variáveis da Vercel |
| Chave pública anon/publishable | Supabase → Project Settings → API | `.env` local e variáveis da Vercel |
| Domínio do site | Domínio contratado por você | Vercel, Site URL e Redirect URLs do Supabase |
| Registros DNS | Instruções da Vercel | Painel do registrador do domínio |
| Credenciais do Google, se habilitado | Google Cloud Console | Painel de provedor OAuth do Supabase |
| SMTP de produção, se necessário | Provedor de e-mail escolhido | Supabase → Authentication → SMTP Settings |

Não é necessário preencher senha do banco nem chave `service_role` no aplicativo. Não envie essas credenciais ao frontend.

## 6. Limites de validação sem credenciais externas

Sem URL/chave Supabase e um projeto configurado, não é possível testar cadastro real, confirmação de e-mail, login, logout, recuperação de senha, sincronização entre dispositivos ou isolamento entre usuários. O build local valida TypeScript e empacotamento; a segurança final depende de executar o SQL no projeto e manter as políticas RLS ativas.

## 7. Como confirmar a conexão real

1. No Supabase, abra **Table Editor** e confirme as tabelas `profiles`, `user_settings`, `transactions`, `categories`, `accounts`, `credit_cards`, `custom_banks`, `budgets` e `financial_goals`.
2. Em **Authentication → Users**, confirme que o usuário de teste aparece após o cadastro.
3. No Fluxary, entre com essa conta, crie uma movimentação e aguarde a sincronização. Atualize a página e confira que ela continua visível.
4. No Supabase, abra **Table Editor → transactions** e confira a nova linha e seu `user_id`. Depois exclua o lançamento de teste pelo Fluxary.
5. Para testar o isolamento, cadastre uma segunda conta e confira que ela não vê os dados da primeira. Mantenha RLS ativa e não use `service_role` no navegador.

Até você criar o projeto, executar o script, preencher as variáveis e configurar os redirecionamentos de Auth, o Fluxary **não está conectado** ao Supabase. A presença de arquivos SQL no repositório, sozinha, não cria nem conecta um banco hospedado.

Para executar os testes adicionais de estrutura e isolamento em uma transação que termina com `ROLLBACK`, abra [`TESTES_BANCO_DE_DADOS.sql`](./TESTES_BANCO_DE_DADOS.sql) no SQL Editor depois de criar duas contas de teste em Authentication → Users. O script falha com uma mensagem explícita se as tabelas/RLS esperadas estiverem ausentes ou se a segunda conta acessar os dados da primeira.
