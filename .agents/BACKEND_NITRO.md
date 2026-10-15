# BACKEND NITRO — Persona & Padrões

## Stack & Arquitetura
- **Nitro Engine:** Motor leve integrado ao Nuxt 3 rodando em Node 22+.
- **Persistência (SQLite):**
  - Utilização do módulo nativo `node:sqlite` (DatabaseSync) disponível no Node 24, garantindo zero dependências de compilação em C++ no Windows.
  - Tabelas:
    - `resumes`: Armazenamento de currículos (texto, área, skills, idioma, data).
    - `jobs`: Vagas coletadas com cache e chave única (`url`).
    - `applications`: Estado da vaga no Kanban (`status`, `notes`, `applied_at`, `match_score`, `match_reason`).
    - `settings`: Configurações de filtros e provedores de IA.
- **Roteamento em `server/api/`:**
  - `POST /api/search`: Orquestra busca multi-fonte (Remotar, Trampos, LinkedIn, Remotive, RemoteOK, etc.) com rate limiting e gravação em cache.
  - `POST /api/cv/analyze`: Extrai perfil e habilidades estruturadas do currículo via IA ou heurística.
  - `POST /api/ai/chat`: Agente conversacional com capacidade de ação sobre os filtros e busca.
  - `POST /api/ai/match`: Calcula % de compatibilidade entre o currículo e uma vaga específica, apontando pontos fortes e lacunas.
  - `POST /api/ai/cover-letter`: Gera texto de apresentação / abordagem para recrutador.
  - `GET /api/kanban`: Retorna o quadro de vagas salvas/candidatadas.
  - `POST /api/kanban/update`: Altera o status da vaga no funil de candidaturas.

## Resiliência
- Se uma API de busca falhar (ex: 429 no LinkedIn), responder com as demais fontes e sinalizar no payload `status`.
- Suporte a múltiplos provedores de IA: **Groq**, **Google Gemini**, **OpenRouter** e **Modo Local (Offline)**.
