<template>
  <header class="border-b border-surface-700/80 bg-surface-900/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-black text-xl">
        🎯
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold text-white tracking-tight">JobFinder <span class="text-brand-500">AI</span></h1>
          <span 
            class="text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1.5"
            :class="aiStatus?.ai ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/60 border-amber-500/40 text-amber-300'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="aiStatus?.ai ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
            {{ aiStatus?.ai ? `IA: ${aiStatus.model}` : 'IA Local (Ative Groq/Gemini)' }}
          </span>
        </div>
        <p class="text-xs text-slate-400">Buscador Inteligente de Empregos • Home Office & Sorocaba</p>
      </div>
    </div>

    <!-- Navegação de Abas -->
    <nav class="flex items-center gap-1 bg-surface-800/80 p-1 rounded-xl border border-surface-700/60">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="$emit('select-tab', tab.id)"
        class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
        :class="activeTab === tab.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700/50'"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span v-if="tab.badge" class="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-surface-900/60 text-brand-200 border border-brand-500/30">
          {{ tab.badge }}
        </span>
      </button>
    </nav>

    <!-- Botão Copilot Chat -->
    <div class="flex items-center gap-2">
      <button 
        @click="$emit('toggle-chat')"
        class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-md shadow-brand-600/25 active:scale-95"
      >
        <span>💬</span>
        <span>Copiloto IA</span>
      </button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  activeTab: { type: String, default: 'explorer' },
  aiStatus: { type: Object, default: () => ({}) },
  savedCount: { type: Number, default: 0 },
});

defineEmits(['select-tab', 'toggle-chat']);

const tabs = computed(() => [
  { id: 'explorer', label: 'Explorador de Vagas', icon: '🔍' },
  { id: 'kanban', label: 'Meu Kanban', icon: '📋' },
  { id: 'resume', label: 'Currículo & Perfil', icon: '📄' },
  { id: 'settings', label: 'Configurações & IA', icon: '⚙️' },
]);
</script>
