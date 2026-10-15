<template>
  <div v-if="job" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
    <div class="bg-surface-800 border border-surface-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
      <!-- Topo -->
      <div class="flex items-start justify-between gap-3 pb-3 border-b border-surface-700/60">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-brand-400">
            Análise de Compatibilidade com IA
          </span>
          <h3 class="text-base font-bold text-white leading-snug">
            {{ job.title }}
          </h3>
          <p class="text-xs text-slate-400 font-medium">
            {{ job.company }} • {{ job.location }}
          </p>
        </div>
        <button 
          @click="$emit('close')"
          class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-700 text-lg transition-colors"
        >
          ✕
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-12 text-center space-y-3">
        <div class="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto"></div>
        <p class="text-xs text-slate-400">
          A IA está cruzando seu currículo com os requisitos da vaga...
        </p>
      </div>

      <!-- Conteúdo da Análise -->
      <div v-else-if="result" class="space-y-4 text-xs">
        <!-- Score Card -->
        <div class="bg-surface-900 border border-surface-700 rounded-2xl p-4 flex items-center gap-4">
          <div 
            class="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-xl border shrink-0"
            :class="result.score >= 80 ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300' : 'bg-brand-950 border-brand-500/50 text-brand-300'"
          >
            <span>{{ result.score }}%</span>
            <span class="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Match</span>
          </div>
          <div>
            <h4 class="font-bold text-white text-sm">Veredito do Recrutador</h4>
            <p class="text-slate-300 mt-0.5 leading-relaxed">
              {{ result.summary }}
            </p>
          </div>
        </div>

        <!-- Pontos Fortes -->
        <div v-if="result.strengths?.length" class="space-y-1.5">
          <h5 class="font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
            <span>✓</span>
            <span>Pontos Fortes Identificados:</span>
          </h5>
          <ul class="space-y-1 bg-surface-900/60 p-3 rounded-xl border border-surface-700/50 text-slate-300">
            <li v-for="(s, i) in result.strengths" :key="i" class="flex items-start gap-1.5">
              <span class="text-emerald-400 shrink-0">•</span>
              <span>{{ s }}</span>
            </li>
          </ul>
        </div>

        <!-- O que pode faltar -->
        <div v-if="result.gaps?.length" class="space-y-1.5">
          <h5 class="font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
            <span>⚠</span>
            <span>Atenção aos Requisitos / Possíveis Lacunas:</span>
          </h5>
          <ul class="space-y-1 bg-surface-900/60 p-3 rounded-xl border border-surface-700/50 text-slate-300">
            <li v-for="(g, i) in result.gaps" :key="i" class="flex items-start gap-1.5">
              <span class="text-amber-400 shrink-0">•</span>
              <span>{{ g }}</span>
            </li>
          </ul>
        </div>

        <!-- Dicas -->
        <div v-if="result.tips" class="bg-brand-950/40 border border-brand-500/30 p-3 rounded-xl text-slate-200">
          <b class="text-brand-300">💡 Dica Estratégica:</b> {{ result.tips }}
        </div>
      </div>

      <!-- Rodapé -->
      <div class="pt-3 border-t border-surface-700/60 flex items-center justify-end gap-2">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-surface-700 transition-colors"
        >
          Fechar
        </button>
        <button 
          @click="$emit('save-kanban', job)"
          class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 transition-all flex items-center gap-1.5 active:scale-95 shadow-md cursor-pointer"
        >
          <span>⭐</span>
          <span>Salvar no Kanban</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  job: { type: Object, default: null },
  cvText: { type: String, default: '' },
  analysis: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save-kanban']);

const loading = ref(true);
const result = ref(null);

watch(() => props.job, async (newJob) => {
  if (!newJob) return;
  loading.value = true;
  result.value = null;
  try {
    const r = await $fetch('/api/ai/match', {
      method: 'POST',
      body: {
        job: newJob,
        cvText: props.cvText,
        analysis: props.analysis
      }
    });
    result.value = r;
  } catch (e) {
    result.value = {
      score: 70,
      summary: 'Compatibilidade moderada.',
      strengths: ['Área de atuação convergente.'],
      gaps: ['Confira os requisitos na vaga.'],
      tips: 'Adapte os termos do seu currículo ao título da vaga.'
    };
  } finally {
    loading.value = false;
  }
}, { immediate: true });
</script>
