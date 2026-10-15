<template>
  <div v-if="job" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
    <div class="bg-surface-800 border border-surface-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
      <!-- Topo -->
      <div class="flex items-start justify-between gap-3 pb-3 border-b border-surface-700/60">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-brand-400">
            Gerador de Abordagem & Apresentação
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
          class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-700 text-lg transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-12 text-center space-y-3">
        <div class="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto"></div>
        <p class="text-xs text-slate-400">
          Escrevendo mensagem personalizada para o recrutador...
        </p>
      </div>

      <!-- Textos Gerados -->
      <div v-else-if="result" class="space-y-5 text-xs">
        <!-- 1. Mensagem de Conexão LinkedIn (Curta) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-white flex items-center gap-1.5">
              <span>💬</span>
              <span>Mensagem de Conexão no LinkedIn (até 300 caracteres)</span>
            </h4>
            <button 
              @click="copyText(result.linkedin_note, 'note')"
              class="px-2.5 py-1 rounded-lg bg-surface-700 hover:bg-brand-600 hover:text-white text-slate-300 font-semibold transition-all active:scale-95"
            >
              {{ copied === 'note' ? '✓ Copiado!' : 'Copiar' }}
            </button>
          </div>
          <div class="bg-surface-900 border border-surface-700 rounded-xl p-3.5 text-slate-200 leading-relaxed font-mono text-[11px]">
            {{ result.linkedin_note }}
          </div>
        </div>

        <!-- 2. Carta de Apresentação (Cover Letter) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-white flex items-center gap-1.5">
              <span>📄</span>
              <span>Carta de Apresentação Direcionada</span>
            </h4>
            <button 
              @click="copyText(result.cover_letter, 'letter')"
              class="px-2.5 py-1 rounded-lg bg-surface-700 hover:bg-brand-600 hover:text-white text-slate-300 font-semibold transition-all active:scale-95"
            >
              {{ copied === 'letter' ? '✓ Copiado!' : 'Copiar' }}
            </button>
          </div>
          <textarea 
            readonly 
            rows="6"
            class="w-full bg-surface-900 border border-surface-700 rounded-xl p-3.5 text-slate-200 leading-relaxed font-mono text-[11px] focus:outline-none"
            :value="result.cover_letter"
          ></textarea>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="pt-3 border-t border-surface-700/60 flex items-center justify-end">
        <button 
          @click="$emit('close')"
          class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-surface-700 hover:bg-surface-600 transition-colors cursor-pointer"
        >
          Fechar
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

defineEmits(['close']);

const loading = ref(true);
const result = ref(null);
const copied = ref('');

const copyText = (txt, id) => {
  navigator.clipboard.writeText(txt);
  copied.value = id;
  setTimeout(() => { copied.value = ''; }, 2000);
};

watch(() => props.job, async (newJob) => {
  if (!newJob) return;
  loading.value = true;
  result.value = null;
  try {
    const r = await $fetch('/api/ai/cover-letter', {
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
      linkedin_note: `Olá! Vi a oportunidade de ${newJob.title} na ${newJob.company} e me identifiquei muito com a proposta. Gostaria de me conectar para acompanhar o processo!`,
      cover_letter: `Prezados,\n\nTenho grande interesse na oportunidade de ${newJob.title} na ${newJob.company}. Minha trajetória me preparou para contribuir ativamente com os desafios da área.\n\nAtenciosamente.`
    };
  } finally {
    loading.value = false;
  }
}, { immediate: true });
</script>
