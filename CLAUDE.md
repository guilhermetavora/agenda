# Agenda OnCourt

Agenda interna de uso pessoal do Guilherme Távora para a OnCourt (marketplace de tênis). Responder sempre em português do Brasil.

## Como funciona
- Site estático publicado no **GitHub Pages**: https://guilhermetavora.github.io/agenda/ (branch `main`, raiz). Qualquer push na `main` publica em 1 ou 2 minutos.
- Dados no **Supabase** (projeto `pfxrqsxujbcxnzscwchh`, região São Paulo): login por e-mail e senha, cadastro público desligado.
- Sem build, sem framework, sem npm: HTML, CSS e JS puros. Abrir `index.html` direto já mostra a interface. Para entrar de verdade é preciso servir por http(s), por exemplo com a extensão Live Server ou `npx serve`.

## Arquivos
- `index.html`: o app inteiro (CSS + JS num arquivo só). A agenda foi escrita originalmente como artefato do Claude e usa `window.claude.use('db' | 'assets' | 'downloads')`.
- `supa-shim.js`: implementa essa mesma interface em cima do Supabase:
  - tela de login;
  - cache em memória;
  - tempo real (postgres_changes);
  - nova sincronização ao voltar para o app;
  - Storage para arquivos;
  - download via `<a download>`.
  Mudanças no app normalmente não precisam mexer aqui.
- `config.js`: URL do Supabase e chave **anon** pública. Ela pode ficar no repositório: a segurança vem do RLS. Nunca colocar a chave service_role ou secret.
- `supabase-setup.sql`: cria a tabela `docs`, as políticas RLS, a publicação realtime e o bucket privado `arquivos`. Já foi rodado.
- `manifest.webmanifest`, `sw.js`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`: PWA e ícone da tela inicial (logo A: calendário com bola de tênis).
  - Ao mudar arquivos da casca, subir a versão do `CACHE` em `sw.js` (`oncourt-vN`).

## Modelo de dados (tabela `docs`)
- Uma linha por documento: `user_id`, `col`, `id`, `data` (jsonb) e `ts` (ms).
- Coleções:
  - `items`: pendências e compromissos (`kind`: `task` ou `event`);
  - `folders`: App, Parcerias, Marketing, Financeiro, Operação;
  - `files`: metadados dos arquivos (`assetId` aponta para o Storage em `arquivos/<user_id>/<assetId>`);
  - `weeknotes`;
  - `settings/lock`: PIN com hash PBKDF2.

## Identidade visual
- Paleta (tokens em `:root`, com modo escuro):
  - paper `#FFF8F3`;
  - ink `#211E1C`;
  - terracota `#B45F43`;
  - azul petróleo `#264653`;
  - verde `#5E6D56`.
- Fontes: Playfair Display (títulos), Poppins (texto), Roboto Mono (horas).
- Estilo simples e com espaço. Saudação "Olá, Guilherme Távora" pequena e em preto. Sino só contornado.

## Preferências do Guilherme
- Quer simples: só **pendências** (com título, descrição, checklist, prazo, horário em horas cheias, prioridade, repetição, anexos), sem notas separadas.
- Não quer: CRM (já tem um hub), diário de decisões, revisão semanal, contagem regressiva de lançamento, texto descritivo sob a saudação, arcos decorativos.
- Lembretes: no app aberto, aviso na tela e som. Com o app fechado, **push** (ver abaixo).

## Notificações push
- O aparelho se inscreve pelo botão "Ativar notificações" (`oncourtEnablePush` em `supa-shim.js`). A inscrição vai para a tabela `push_subs`. A chave pública VAPID está em `config.js`.
- A Edge Function `lembretes` roda no Supabase. O código fica em `supabase/lembretes.ts` e **NÃO vai para o GitHub**, porque contém a chave privada VAPID.
  - É chamada a cada minuto pelo pg_cron (job `oncourt-lembretes`, criado por `supabase/push-setup.sql`).
  - Calcula os lembretes vencidos com a mesma lógica do app (fuso de Brasília, até 30 min de atraso).
  - Evita repetir pela tabela `push_sent` e envia via web-push.
  - Com `{test:true}` e o JWT do usuário, manda uma notificação de teste.
- `sw.js` mostra a notificação (evento `push`) e abre o app ao tocar.
- No iPhone, o push só funciona com o app adicionado à tela de início (iOS 16.4 ou mais novo).
