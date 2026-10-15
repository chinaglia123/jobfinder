<template>
  <div class="px-4 lg:px-8 py-5 lg:py-7">
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Candidaturas</h1>
        <p class="text-muted mt-1">Arraste os cartões entre as etapas para acompanhar cada processo.</p>
      </div>
      <button class="btn-secondary btn-sm" @click="fetchKanban"><RefreshCw class="w-4 h-4" /> Atualizar</button>
    </header>

    <div v-if="!total" class="card p-10 text-center max-w-xl mx-auto">
      <Bookmark class="w-10 h-10 mx-auto mb-3 text-subtle" />
      <p class="font-semibold">Nenhuma vaga salva ainda</p>
      <p class="text-muted text-[13px] mt-1">Na busca, clique no marcador de uma vaga para trazê-la para cá.</p>
      <button class="btn-primary mt-4" @click="$emit('go', 'jobs')"><Search class="w-4 h-4" /> Procurar vagas</button>
    </div>

    <div v-else class="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory lg:snap-none -mx-4 px-4 lg:mx-0 lg:px-0 scroll-thin">
      <section
        v-for="col in COLUMNS" :key="col.id"
        class="snap-start shrink-0 w-[82vw] sm:w-72 lg:flex-1 lg:min-w-[220px] flex flex-col rounded-2xl bg-surface-2/70 border transition-colors"
        :class="over === col.id ? 'border-accent bg-accent-soft/40' : 'border-line'"
        :aria-label="col.title"
        @dragover.prevent="over = col.id"
        @dragleave="over === col.id && (over = null)"
        @drop.prevent="drop(col.id)"
      >
        <div class="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
          <span class="w-2 h-2 rounded-full" :class="col.dot"></span>
          <h2 class="text-[13px] font-semibold flex-1">{{ col.title }}</h2>
          <span class="text-[12px] font-semibold tabular-nums text-subtle">{{ kanban[col.id]?.length || 0 }}</span>
        </div>

        <div class="flex-1 px-2.5 pb-2.5 space-y-2 min-h-[120px] lg:max-h-[calc(100vh-220px)] overflow-y-auto scroll-thin">
          <article
            v-for="item in kanban[col.id] || []" :key="item.application_id"
            class="group bg-surface border border-line rounded-xl p-3 shadow-card cursor-grab active:cursor-grabbing"
            :class="dragging?.application_id === item.application_id && 'opacity-40'"
            draggable="true"
            @dragstart="dragging = item"
            @dragend="dragging = null; over = null"
          >
            <div class="flex items-start gap-2.5">
              <UiCompanyAvatar :name="item.company" size="sm" />
              <div class="min-w-0 flex-1">
                <h3 class="text-[13px] font-semibold leading-snug line-clamp-2">{{ item.title }}</h3>
                <p class="text-[12px] text-muted truncate">{{ item.company }}</p>
              </div>
              <span v-if="item.match_score" class="text-[12px] font-bold tabular-nums" :class="item.match_score >= 70 ? 'text-ok' : item.match_score >= 45 ? 'text-accent' : 'text-warn'">{{ item.match_score }}%</span>
            </div>
            <div class="mt-2.5 flex items-center gap-1.5">
              <UiModeBadge :mode="item.mode" />
              <span class="text-[11px] text-subtle truncate flex-1">{{ ago(item.updated_at) }}</span>
              <a :href="item.url" target="_blank" rel="noopener noreferrer" class="grid place-items-center w-7 h-7 rounded-lg text-subtle hover:text-ink hover:bg-surface-2" aria-label="Abrir vaga"><ExternalLink class="w-3.5 h-3.5" /></a>
              <button class="grid place-items-center w-7 h-7 rounded-lg text-subtle hover:text-bad hover:bg-bad-soft" aria-label="Remover" @click="remove(item)"><Trash2 class="w-3.5 h-3.5" /></button>
            </div>
            <!-- Mover sem arrastar (celular / teclado) -->
            <select
              :value="col.id"
              class="select h-8 mt-2 text-[12px] lg:hidden"
              aria-label="Mover para etapa"
              @change="move(item, $event.target.value)"
            >
              <option v-for="c in COLUMNS" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
          </article>
          <p v-if="!(kanban[col.id] || []).length" class="text-center text-[12px] text-subtle py-6">Solte uma vaga aqui</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { RefreshCw, Bookmark, Search, ExternalLink, Trash2 } from '@lucide/vue';

defineEmits(['go']);
const { kanban, fetchKanban, saveJob, removeSaved, toast } = useJobFinder();

const COLUMNS = [
  { id: 'saved', title: 'Salvas', dot: 'bg-subtle' },
  { id: 'applied', title: 'Candidatei-me', dot: 'bg-accent' },
  { id: 'interview', title: 'Entrevista', dot: 'bg-warn' },
  { id: 'offer', title: 'Proposta', dot: 'bg-ok' },
  { id: 'rejected', title: 'Encerradas', dot: 'bg-bad' },
];

const dragging = ref(null);
const over = ref(null);
const total = computed(() => COLUMNS.reduce((n, c) => n + (kanban.value[c.id]?.length || 0), 0));

// updated_at vem do SQLite em UTC sem fuso ("2026-10-15 13:00:00")
const ago = (s) => (s ? 'atualizada ' + timeAgo(s.replace(' ', 'T') + 'Z') : '');

async function move(item, status) {
  if (item.status === status) return;
  if (await saveJob(item, status)) toast(`Movida para "${COLUMNS.find((c) => c.id === status)?.title}"`);
}
function drop(status) {
  const item = dragging.value;
  dragging.value = null;
  over.value = null;
  if (item) move(item, status);
}
async function remove(item) {
  await removeSaved(item.application_id);
  toast('Removida das candidaturas');
}

onMounted(fetchKanban);
</script>
