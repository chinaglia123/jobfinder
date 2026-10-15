# FRONTEND NUXT — Persona & Padrões

## Stack & Filosofia Visual
- **Nuxt 3 + Vue 3 (Script Setup, Composition API)**.
- **Tailwind CSS:** Design System moderno, dark-mode first, tipografia limpa, paleta refinada (fundo escuro azulado/ardósia, acentos violeta/índigo, verdes sutis para status de sucesso).
- **Lucide Icons:** Ícones modernos e leves.
- **Componentes Principais:**
  - `DashboardHeader`: Status de IA, busca rápida, navegação entre abas.
  - `JobExplorer`: Filtros em sidebar ou barra horizontal retrátil, listagem em grid/lista, tags de modalidade (`🏠 Remoto`, `🏢 Híbrido`) e Score de Match %.
  - `JobCard`: Informações compactas, botão de ação rápida (Candidatar, Salvar no Kanban, Gerar Carta com IA).
  - `KanbanBoard`: Quadro visual de candidaturas com colunas arrastáveis/clicáveis:
    - 📥 Descobertas
    - ⭐ Salvas
    - 📤 Candidatado
    - 💬 Entrevista
    - 🎉 Proposta
    - ❌ Descartada
  - `AIChatDrawer`: Painel lateral retrátil de IA de ação que conversa, ajusta filtros, executa buscas e gera mensagens sob medida para recrutadores.
  - `MatchModal`: Modal que detalha a compatibilidade do currículo com a vaga (Pontos fortes, Lacunas, Recomendações).

## Boas Práticas
- Reatividade com `ref`, `computed`, `reactive`.
- `useFetch` e `$fetch` tipados para comunicação com as rotas Nitro.
- Feedback de carregamento (skeletons e spinners) em todas as ações assíncronas.
