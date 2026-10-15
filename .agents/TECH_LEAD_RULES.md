# TECH LEAD RULES — Job Finder AI

## Princípios de Engenharia
1. **Confiabilidade sobre complexidade:** Nunca quebre o fluxo do usuário com telas brancas ou erros 500 não tratados. Se uma API de busca falhar (ex: rate limit 429), as outras devem continuar entregando resultados e o status deve ser informado com clareza.
2. **Arquitetura Modular:**
   - **Frontend (Nuxt 3 / Vue 3):** Componentes pequenos, reativos, tipados e estilizados com Tailwind CSS. Micro-interações fluidas e responsividade desktop/mobile.
   - **Backend (Nitro Server Engine):** Rotas em `server/api/`, organizadas por domínio (`search`, `cv`, `ai`, `jobs`, `kanban`).
   - **Camada de Dados (SQLite):** Persistência local robusta, sem necessidade de instalar servidores externos de banco (Postgres/MySQL) para rodar localmente.
   - **Camada de IA (Multi-Provedor):** Suporte flexível a Groq, Gemini e OpenRouter com fallback automático para análise heurística local quando não houver chave.
3. **Resiliência e Cache:**
   - Vagas coletadas são salvas no banco de dados local para buscas instantâneas e sem custo de requisições repetidas.
   - Rate limiters e delays controlados para APIs externas.
4. **Métricas e Transparência:**
   - O usuário deve ver o status de cada plataforma (Remotar, Trampos, LinkedIn, etc.) e o progresso em tempo real.
