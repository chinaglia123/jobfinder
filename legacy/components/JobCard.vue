<template>
  <div class="group bg-surface-800 border border-surface-700/80 hover:border-brand-500/50 rounded-2xl p-5 transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-brand-500/5 flex flex-col justify-between">
    <div>
      <!-- Topo: Badges de Modalidade e Match -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Modalidade -->
          <span 
            class="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
            :class="{
              'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300': job.mode === 'remote',
              'bg-amber-950/70 border border-amber-500/40 text-amber-300': job.mode === 'hybrid',
              'bg-rose-950/70 border border-rose-500/40 text-rose-300': job.mode === 'onsite',
              'bg-surface-700 border border-surface-600 text-slate-300': job.mode === 'unknown'
            }"
          >
            {{ modeLabel(job.mode) }}
          </span>

          <!-- Fonte -->
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-surface-700/70 border border-surface-600/70 text-slate-300">
            {{ job.source }}
          </span>

          <!-- Candidatos / Recência -->
          <span v-if="job.applicants" class="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-brand-950/70 border border-brand-500/40 text-brand-300">
            👥 {{ job.applicants }} candidatos
          </span>
          <span v-else-if="job.fewApplicants" class="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            🔥 Poucas candidaturas
          </span>
        </div>

        <!-- Match Score -->
        <div 
          v-if="job.matchScore"
          class="flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl border shrink-0"
          :class="matchClass(job.matchScore)"
          title="Compatibilidade estimada com seu currículo"
        >
          <span>🎯</span>
          <span>{{ job.matchScore }}%</span>
        </div>
      </div>

      <!-- Título da Vaga e Empresa -->
      <h3 class="text-base font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-2 leading-snug mb-1">
        {{ job.title }}
      </h3>
      <div class="text-xs text-slate-300 font-medium mb-3 flex items-center gap-1.5 flex-wrap">
        <span class="text-slate-100 font-semibold">{{ job.company }}</span>
        <span>•</span>
        <span class="text-slate-400">{{ job.location || 'Localização não informada' }}</span>
        <span v-if="publishedAgo">•</span>
        <span v-if="publishedAgo" class="text-slate-400">{{ publishedAgo }}</span>
      </div>

      <!-- Habilidades do currículo encontradas na vaga -->
      <div v-if="job.matchedSkills && job.matchedSkills.length" class="text-[11px] text-emerald-300/90 mb-2">
        ✓ Seu CV: {{ job.matchedSkills.join(', ') }}
      </div>

      <!-- Tags / Habilidades -->
      <div v-if="job.tags && job.tags.length" class="flex flex-wrap gap-1 mb-4">
        <span 
          v-for="t in [...new Set(job.tags)].slice(0, 4)" 
          :key="t"
          class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface-900/60 text-slate-300 border border-surface-700/60"
        >
          {{ t }}
        </span>
      </div>
    </div>

    <!-- Barra de Ações Rápidas -->
    <div class="pt-3 border-t border-surface-700/60 flex items-center justify-between gap-2 mt-2">
      <div class="flex items-center gap-1">
        <!-- Salvar no Kanban -->
        <button 
          @click="$emit('save-kanban', job)"
          class="p-2 rounded-xl border border-surface-700 bg-surface-900/50 hover:bg-brand-600 hover:text-white hover:border-brand-500 text-slate-300 transition-all text-xs flex items-center gap-1.5 active:scale-95"
          title="Salvar no Kanban"
        >
          <span>⭐</span>
          <span class="hidden sm:inline font-semibold">Salvar</span>
        </button>

        <!-- Analisar Match -->
        <button 
          @click="$emit('open-match', job)"
          class="p-2 rounded-xl border border-surface-700 bg-surface-900/50 hover:bg-surface-700 text-slate-300 transition-all text-xs flex items-center gap-1"
          title="Analisar compatibilidade com IA"
        >
          <span>✨</span>
          <span class="hidden sm:inline font-semibold">Match</span>
        </button>

        <!-- Carta de Apresentação / Mensagem LinkedIn -->
        <button 
          @click="$emit('open-letter', job)"
          class="p-2 rounded-xl border border-surface-700 bg-surface-900/50 hover:bg-surface-700 text-slate-300 transition-all text-xs flex items-center gap-1"
          title="Gerar mensagem para recrutador com IA"
        >
          <span>✍️</span>
          <span class="hidden sm:inline font-semibold">Carta</span>
        </button>
      </div>

      <!-- Link Externo -->
      <a 
        :href="job.url" 
        target="_blank" 
        rel="noopener noreferrer"
        class="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-brand-600 hover:bg-brand-500 text-white transition-all flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
      >
        <span>Ver vaga</span>
        <span>↗</span>
      </a>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  job: { type: Object, required: true }
});

defineEmits(['save-kanban', 'open-match', 'open-letter']);

const modeLabel = (mode) => {
  if (mode === 'remote') return '🏠 100% Remoto';
  if (mode === 'hybrid') return '🏢 Híbrido';
  if (mode === 'onsite') return '📍 Presencial';
  return '❔ Modalidade a confirmar';
};

const matchClass = (score) => {
  if (score >= 70) return 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
  if (score >= 45) return 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300';
  return 'bg-amber-950/80 border-amber-500/50 text-amber-300';
};

const publishedAgo = computed(() => {
  if (!props.job.date) return null;
  const d = new Date(props.job.date);
  if (isNaN(d.getTime())) return null;
  const diffH = Math.round((Date.now() - d.getTime()) / 36e5);
  if (diffH <= 0) return 'hoje';
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `há ${diffD}d`;
});
</script>
