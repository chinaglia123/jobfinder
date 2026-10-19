# Estado do Projeto — Job Finder AI

## 🚀 Arquitetura Definitiva (v1.0 — Nuxt 3 + Nitro + SQLite + Tailwind)
O software foi totalmente reestruturado a partir do protótipo inicial para uma aplicação profissional, robusta e pronta para produção.

### 🌐 Como Rodar
```bash
npm run dev     # Inicia o servidor Nuxt 3 em http://localhost:3000
```
- Acesse pelo navegador em: **[http://localhost:3000](http://localhost:3000)**

---

### ✨ O que foi construído (Opções A + B Concluídas)

1. **Frontend Nuxt 3 + Vue 3 + Tailwind CSS:**
   - **Dashboard Integrado:** Interface dark mode profissional, responsiva e com micro-interações fluidas.
   - **Explorador de Vagas:** Filtros instantâneos de modalidade (`🏠 100% Remoto`, `🏢 Híbrido`, `Qualquer`), senioridade (`Júnior / Assistente`, `Até Pleno`), período e raio de Sorocaba.
   - **Match Score % Visual:** Cada vaga exibe um anel/badge de 0 a 100% calculando a compatibilidade com o currículo ativo.
   - **Quadro Kanban de Candidaturas:** Funil de 5 etapas (`⭐ Salvas`, `📤 Candidatado`, `💬 Em Entrevista`, `🎉 Proposta`, `❌ Descartadas`) com persistência em tempo real.
   - **Analisador de Currículo:** Suporte a upload/cola de texto em Português e Inglês, extraindo competências, senioridade e aplicando cargos recomendados à busca com 1 clique.
   - **Modal de Match com IA:** Diagnóstico detalhado de pontos fortes, possíveis lacunas de requisitos e dicas estratégicas do recrutador.
   - **Gerador de Abordagem & Carta:** Criação com IA de mensagens curtas para conexão no LinkedIn (até 300 caracteres) e carta de apresentação persuasiva.
   - **Copiloto IA Drawer:** Chat lateral interativo com capacidade de ação sobre os filtros e execução de busca.

2. **Backend Nitro Server & Banco de Dados SQLite:**
   - **Persistência com `node:sqlite` nativo (Node 24):** Zero dependências em C++, sem risco de quebra no Windows.
   - **Cache Automático:** Vagas encontradas são salvas na tabela `jobs` do SQLite (`.data/jobfinder.db`) para consultas rápidas.
   - **Gerenciador de Candidaturas:** Tabela `applications` que mantém o histórico de status, notas e data de atualização de cada vaga.

3. **Inteligência Artificial Multi-Provedor (`server/utils/ai.js`):**
   - **Groq:** Suporte direto ao Llama 3.3 (gratuito, sem cartão, respostas instantâneas).
   - **Google Gemini:** Suporte ao Gemini 2.5 Flash / 1.5 Flash.
   - **OpenRouter:** Suporte a modelos abertos.
   - **Motor Local (Fallback):** Heurísticas determinísticas que garantem que o sistema funcione 100% mesmo se nenhuma chave for configurada ou a internet oscilar.

4. **Fontes de Dados Confiáveis:**
   - **Remotar:** Vagas 100% remotas e híbridas agregadas dos principais portais brasileiros (Gupy, Solides, InHire, Lever, Greenhouse).
   - **Trampos.co:** API oficial de vagas do ecossistema digital nacional.
   - **LinkedIn Guest:** Coleta com verificação de descrição e detecção de vagas com poucas candidaturas.
   - **Fontes Globais:** Remotive, RemoteOK, Jobicy.
   - **Atalhos Pré-configurados:** Links diretos com filtros embutidos para Indeed, Google Vagas, Vagas.com, Catho e Gupy.

---

### 📋 Próximas Evoluções Sugeridas
1. Alertas automáticos por e-mail quando novas vagas surgirem.
2. Preparação de container Docker para deploy na nuvem (Railway, Render ou Vercel).

---

### 🔧 Fase 1 — Correções de busca, filtros e match (out/2026)
- A interface antiga (`public/index.html` + `server.js`) estava sendo servida no lugar do app Nuxt e chamava rotas inexistentes. Foi movida para `legacy/` (não é mais usada).
- Modalidade: detecção pelo título + descrição, com negações ("não é remoto"), benefícios ("auxílio home office") e híbrido "3x por semana" (`classifyMode` em `server/utils/search.js`).
- LinkedIn: página pública (~60 vagas por consulta), confirmação da modalidade lendo a descrição (sequencial, pois paralelo gera 429) e cache em `job_details` no SQLite.
- Relevância com sinônimos PT/EN (`buildMatcher`); Jobicy/Remotive recebem termos em inglês; Remotar e Trampos com mais páginas.
- Match % real (habilidades do CV + cargo-alvo + nível + frescor), enviado só quando há currículo analisado.
- Filtros sincronizados entre Explorador, Currículo e Copiloto, salvos no navegador; respostas de buscas antigas são descartadas.

### 🏢 Fase 2 — Vagas direto das empresas + indexador em segundo plano (out/2026)
- **Novas fontes ao vivo:** Gupy (API do portal, com filtro de modalidade e descrição completa), Himalayas (vagas remotas internacionais que aceitam quem mora no Brasil) e Get on Board (América Latina). Remotive e Jobicy agora também valem para a busca no Brasil, filtrando quem aceita o país (`openToBrazil`).
- **Índice local** (`index_jobs`): o indexador (`server/utils/indexer.js`, iniciado por `server/plugins/indexer.ts`) baixa a cada 6h os quadros de vagas das empresas em `companies` — Greenhouse, Lever, Ashby — e os agregadores RemoteOK, We Work Remotely e Working Nomads (`server/utils/ats.js`). A busca consulta o índice na hora.
- **Empresas:** 34 quadros iniciais conferidos (Nubank, Stone, QuintoAndar, XP, C6, CI&T, GitLab...). Em Configurações dá para adicionar qualquer empresa colando o link da página de vagas, ligar/desligar e forçar atualização.
- **Fila do LinkedIn** (`verify_queue`): vagas que a busca não teve tempo de confirmar são lidas com calma em segundo plano (1 a cada ~1,5s, pausa de 10 min se o LinkedIn limitar). A busca caiu de ~60s para ~30s.
- Para desligar o indexador: `JOBFINDER_INDEXER=off` no `.env`.
- APIs novas: `GET /api/index/status`, `POST /api/index/run`, `GET/POST /api/companies`, `PATCH /api/companies/:id`.

### 🎨 Fase 4 — Interface nova + currículo em PDF (out/2026)
- **Visual:** design system com tokens de cor (`assets/css/main.css` + `tailwind.config.js`), tema claro/escuro/automático (`ThemeToggle.vue`), ícones Lucide (`@lucide/vue`) no lugar de emojis.
- **Navegação:** menu lateral no computador, barra inferior no celular. Estado compartilhado em `composables/useJobFinder.js`.
- **Vagas:** cargos em chips, modalidade em botões, filtros extras recolhíveis no celular; lista + painel de detalhes lado a lado a partir de 1280px (painel lateral/tela cheia abaixo disso). A busca roda em duas etapas: fontes rápidas em ~8s e o LinkedIn mesclado quando chega.
- **Detalhes da vaga** (`JobDetail.vue`): descrição completa em parágrafos, match com o currículo, análise detalhada dos requisitos e mensagem/carta para o recrutador com botão copiar (substituem os antigos modais, movidos para `legacy/components/`).
- **Currículo** (`ResumeSection.vue` + `POST /api/cv/upload`): arrastar PDF, DOCX ou TXT (via `unpdf` e `mammoth`); cargos, habilidades, nível e nome editáveis.
- **Candidaturas:** quadro com arrastar e soltar entre etapas (e seletor no celular), remover vaga (`DELETE /api/kanban/:id`).

### 🐍 Fase 3 — Agente local em Python (out/2026)
- Pasta `agente-local/`: `agente.py` (servidor HTTP só em 127.0.0.1:8765, sem dependências além do JobSpy), `iniciar.bat`/`iniciar.sh` (criam o ambiente na primeira vez) e `LEIAME.md`.
- Busca no **Indeed** e no **Glassdoor** via JobSpy — sites que bloqueiam servidores na nuvem. No teste: Indeed 200 + Glassdoor 120 vagas em ~3s.
- O **navegador** fala com o agente (funciona com o app local ou hospedado) e manda o resultado para `POST /api/search/external`, que aplica o mesmo funil (`server/utils/pipeline.ts`).
- Segurança: só aceita chamadas do app local e das origens em `JOBFINDER_ORIGENS`; responde ao preflight de rede privada do Chrome.
- Download pela tela: `GET /api/agente/download` gera um .zip; no site hospedado, os scripts já saem com o endereço do site autorizado.

### 👥 Fase 5 — Contas e dados por pessoa (out/2026)
- `JOBFINDER_MODE=local` (padrão, sem login, user_id 0) ou `hosted` (exige conta).
- Contas com senha (scrypt) e sessão em cookie httpOnly (`server/utils/auth.ts`, `server/middleware/auth.ts`); a primeira conta vira administradora. `JOBFINDER_CONVITE` opcional restringe o cadastro.
- Candidaturas, currículo/perfil/filtros (`user_data`), análises e vagas ocultas são separados por pessoa. Migração automática da tabela `applications`.
- Limites por pessoa no modo hospedado: 40 buscas/h, 60 chamadas de IA/h, 20 análises de currículo/h; login 10 tentativas/15 min.
- Hospedagem: `Dockerfile`, `render.yaml` e `.env.example`. Ver "Como hospedar" abaixo.

### 🎯 Ajustes de busca e filtros (out/2026)
- **Mais variedade:** novas fontes diretas **Vagas.com** e **InfoJobs**; "cargos relacionados" (ex: marketing → social media, growth, tráfego pago, CRM, SEO, conteúdo, branding, comunicação…) que entram na busca com peso menor no ranking; sinônimos de marketing ampliados.
- **Só vagas em português:** idioma detectado por vaga (`detectLang`); interruptor nos filtros e selo EN/ES na lista.
- **Excluir palavras do título** (pelo radical: "estágio" também tira "estagiário").
- **Tipo de contrato** (CLT, PJ, estágio, freela, temporária) como filtro rápido na lista.
- **Ocultar vagas** ("Não tenho interesse"), com Desfazer e lista em Ajustes para mostrar de novo.
- Busca padrão (marketing, remoto + híbrido): de 233 para ~520 vagas, 13 fontes.

---

## 🚀 Como hospedar (para outras pessoas usarem)

Passo a passo completo em **[COMO_HOSPEDAR.md](COMO_HOSPEDAR.md)** (Vercel + Turso, grátis).
Alternativa com servidor próprio: `Dockerfile` (+ `render.yaml`), com volume em `/data`.

## 🧪 Rodar no seu computador
```bash
npm install
npm run dev
```
Abra http://localhost:3000. Para Indeed/Glassdoor, dê dois cliques em `agente-local/iniciar.bat`.

### 🔑 Chave de IA própria (out/2026)
- Em **Ajustes → Sua chave de IA**, cada pessoa escolhe Groq, Gemini ou OpenRouter, cola a chave e clica em **Testar e salvar** (`POST /api/ai/test`).
- A chave fica só no navegador (`localStorage`) e vai nos cabeçalhos `X-AI-Provider` / `X-AI-Key` / `X-AI-Model` apenas nas chamadas de IA (`server/utils/ai-creds.ts`). O servidor não grava nem registra a chave; o Gemini recebe a chave por cabeçalho, não pela URL.
- Ordem de uso: chave da pessoa → chave do servidor (.env) → análise local. Se a chave da pessoa falhar, a resposta traz `keyError` e a tela avisa.
- No modo hospedado, quem usa a própria chave não consome a cota de IA do servidor.

### ☁️ Vercel + Turso (out/2026)
- `server/utils/db.js`: interface assíncrona única com três motores — **Turso** (`TURSO_DATABASE_URL`, cliente HTTP sem módulos nativos), **libSQL em arquivo** (`JOBFINDER_DB=libsql`, para testar o caminho do Turso localmente) e **node:sqlite** (padrão local/Docker). Esquema versionado (`schema_version`): só roda migrações quando muda.
- Todas as rotas e módulos convertidos para `await db.get/all/run/batch`. A busca não grava mais as vagas na tabela `jobs` (eram até 200 gravações por busca); só ao salvar nas candidaturas.
- Limite de uso agora fica no banco (`rate_limits`), porque cada execução na Vercel pode cair numa instância diferente.
- Indexador: em servidor contínuo segue no plugin; na Vercel roda em `GET /api/cron/indexar` (protegido por `CRON_SECRET`) — cron diário da Vercel (`nuxt.config` → `nitro.vercel.config.crons`) + GitHub Actions a cada 6h (`.github/workflows/indexar.yml`).
- Arquivos do agente embutidos no build (`nitro.serverAssets`), para o download funcionar na Vercel.
- Testado: modo local (seus dados preservados), modo hospedado sobre libSQL (contas, isolamento, ocultas, limite, logout), 30 gravações simultâneas durante a indexação (0 erros) e build `NITRO_PRESET=vercel` (função com 300s, cron no config, sem módulos nativos).

### 🛡️ Confiança, escala e candidatura sob medida (out/2026)
- **Vagas repetidas:** a mesma vaga em várias fontes vira uma só (`shared/jobs.js`: impressão digital empresa + cargo), com "também em" e o link da própria empresa como principal.
- **Golpes e vagas fantasma** (`server/utils/trust.js`): sinais com motivos explicados (pede taxa, tarefas em casa, ganho fácil, pirâmide, e-mail pessoal + só WhatsApp; banco de talentos, aberta há meses, repostada). Golpe com sinal forte some da lista (filtro "Esconder vagas suspeitas").
- **Salário:** lido da vaga quando informado; senão, faixa estimada pelas vagas parecidas da mesma busca (mín. 3). **Empresa:** vagas abertas no site de carreiras + atalhos para Glassdoor, Reclame Aqui e LinkedIn (`/api/company/info`).
- **Escala:** novos sistemas Workable, SmartRecruiters (só vagas do Brasil) e Recruitee; **descoberta automática** (`server/utils/discovery.js`): empresas vistas nas buscas e links de sistemas de recrutamento viram candidatas, conferidas pela rotina (nome do quadro precisa bater + ao menos uma vaga aberta ao Brasil). Descobertas atualizam a cada 12h e guardam só vagas do Brasil. Indexador só regrava vagas que mudaram (`content_hash`).
- **Correção do cadastro inicial:** `greenhouse/arco` era a ARCO Companies (EUA), `remote` a General Assembly e `flash` outra empresa; removidos (migração v7). Arco Educação = `arcoeducacao`, Flash = `lever/flashapp`.
- **Candidatura sob medida** (`/api/ai/tailor-cv`, `components/ApplicationKit.vue`): currículo reescrito para a vaga sem inventar nada (verificação depois da IA remove habilidades ausentes do original, níveis inflados e títulos de cargos que a pessoa não teve; sinaliza números novos), carta e mensagem; exporta PDF e DOCX legíveis por ATS (`composables/cvExport.js`) e "Abrir vaga e marcar como candidatada".

### 🎯 Pontuação ATS e buscas ampliadas (out/2026)
- **Nota ATS** (`shared/ats.js`, roda na tela e no servidor): lê a vaga (palavras-chave obrigatórias × desejáveis, alternativas "A ou B" contam como um requisito, anos de experiência, formação, idiomas, termos do cargo) e dá 0–100 com detalhamento: palavras-chave 45, cargo 15, experiência 10, formação 10, idiomas 5, formato/seções 15.
  Aparece no painel da vaga (currículo atual) e em "Preparar candidatura" (ao vivo enquanto edita, comparando com o original). "Tenho isso" adiciona o requisito às competências.
- O currículo sob medida recebe os termos que o ATS procura e os usa quando descrevem algo real; termos da vaga associados pela IA ficam para a pessoa **confirmar**.
- **Triagem simulada com IA** (`/api/ai/ats-screen`): avança / talvez / reprovado, eliminatórios e ajustes condicionais ("se você tem X…").
- **Explorar tudo**: modo sem filtro de cargo (vagas mais recentes de todas as fontes e do índice, até 600).
- **Varredura** (`server/utils/sweep.js`): percorre todas as 32 áreas (algumas por rodada) + uma passada sem filtro nas fontes rápidas só para anotar empresas para a descoberta (local a cada 30 min; na Vercel junto do cron; botão "Varrer agora"). Primeira rodada: 4.955 vagas lidas, ~2.000 empresas anotadas em 11s.
- **Fontes novas:** Catho e Programathor (tecnologia, remotas, sem vagas vencidas). Descoberta com 8 conferências em paralelo, até 150 por rodada.

### 📡 Mais vagas e agente pelo servidor (out/2026)
- A busca devolve até **1.000 vagas** (antes 300; a tela mostra de 40 em 40). Com o perfil de CRM/RevOps a lista foi de 300 para 490, e a Catho, que antes era cortada, passou a aparecer.
- **Empregos.com.br** como fonte nova (lê os dados que o site já manda no HTML; a modalidade vem do site, corrigida pelo texto da vaga).
- **Agente pelo servidor** (`server/utils/agent.ts`, `/api/search/agente`, `/api/agente/status`): quando o JobFinder e o agente Python rodam no mesmo PC, o servidor chama o agente direto. Quem abre o site de outro aparelho da rede também recebe Indeed e Glassdoor. Sem agente ao lado do servidor (Vercel), a tela tenta o agente pelo navegador, como antes.
- Agente: Indeed busca até 100 vagas por cargo e o Glassdoor até 50.

### 🚀 Pronto para publicar (out/2026)
- **Página de entrada** nova (`LoginScreen.vue`): explica o que o site faz, com "Criar conta" em destaque; `?convite=CODIGO` no link preenche o convite.
- **Primeiro acesso guiado** (`Onboarding.vue`): conta nova → envia o currículo (ou escolhe áreas) → confere cargos, modalidade e cidade → busca. Os filtros iniciais agora são neutros (sem cargo nem cidade fixos).
- **IA do site com cota diária** por pessoa (`JOBFINDER_IA_POR_DIA`, padrão 40) quando a chave é do site; quem usa a própria chave não tem esse limite.
- Correção: depois do login os dados da pessoa não carregavam até recarregar a página (a tela de login sumia antes de avisar o app). Agora o app observa a conta.
- Upload e análise do currículo compartilhados em `composables/useCvUpload.js`.

### 🌐 Ambiente em Produção Ativo (out/2026)
- **Site em Produção (Vercel):** `https://jobfinder-woad.vercel.app`
- **Repositório GitHub conectado:** `https://github.com/chinaglia123/jobfinder` (deploy contínuo na branch `main`)
- **Banco de Dados (Turso SQLite HTTP):** `libsql://jobfinder-chinaglia123.aws-sa-east-1.turso.io` (36 empresas iniciais + schema v8 inicializado)
- **Modo:** `JOBFINDER_MODE=hosted` (multi-usuário com isolamento de dados e suporte a chave de IA individual por navegador)
- **Melhorias no Cadastro e Primeiro Acesso:**
  - `LoginScreen.vue`: botão para visualizar/esconder senha (`Eye`/`EyeOff`) no login e cadastro + campo **Confirmar senha** com validação em tempo real no cadastro.
  - `Onboarding.vue`: inicia pelo passo **1. Chave de IA (grátis)** (atalho direto para gerar a Key na Groq/Gemini/OpenRouter e testar na hora antes de ler o currículo) + botões destacados em todas as etapas para **Pular currículo e escolher área** ou **Pular e ir direto para a busca**.


