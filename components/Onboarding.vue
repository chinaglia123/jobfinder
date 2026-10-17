<template>
  <div class="px-4 lg:px-8 py-6 lg:py-10 max-w-2xl mx-auto">
    <header class="mb-6">
      <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Boas-vindas{{ firstName ? `, ${firstName}` : '' }}!</h1>
      <p class="text-muted mt-1">Em dois passos a gente monta a sua busca. Dá para mudar tudo depois.</p>
      <ol class="mt-4 flex items-center gap-2 text-[13px] font-semibold" aria-label="Passos">
        <li v-for="(s, i) in STEPS" :key="s" class="flex items-center gap-2" :class="step === i + 1 ? 'text-ink' : step > i + 1 ? 'text-ok' : 'text-subtle'" :aria-current="step === i + 1 ? 'step' : undefined">
          <span class="grid place-items-center w-6 h-6 rounded-full text-[12px]" :class="step === i + 1 ? 'bg-accent text-white dark:text-bg' : step > i + 1 ? 'bg-ok-soft text-ok' : 'bg-surface-2'">
            <Check v-if="step > i + 1" class="w-3.5 h-3.5" /><template v-else>{{ i + 1 }}</template>
          </span>
          {{ s }}
          <ChevronRight v-if="i < STEPS.length - 1" class="w-4 h-4 text-subtle" />
        </li>
      </ol>
    </header>

    <!-- Passo 1: currículo -->
    <section v-if="step === 1" class="card p-5 lg:p-6 space-y-4 animate-fade-up" aria-label="Enviar currículo">
      <div>
        <h2 class="font-semibold text-[16px]">Envie seu currículo</h2>
        <p class="text-[13px] text-muted mt-0.5">Lemos seu nível, os cargos que combinam com você e suas habilidades. Assim cada vaga ganha uma nota de match.</p>
      </div>
      <label
        class="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors"
        :class="dragging ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-accent/50 hover:bg-surface-2/60'"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".pdf,.docx,.txt,application/pdf" class="sr-only" :disabled="busy" @change="onPick" />
        <div class="w-12 h-12 rounded-2xl bg-accent-soft text-accent grid place-items-center">
          <LoaderCircle v-if="busy" class="w-6 h-6 animate-spin" />
          <CloudUpload v-else class="w-6 h-6" />
        </div>
        <div class="font-semibold">{{ busy ? busyLabel : 'Arraste seu currículo aqui' }}</div>
        <div class="text-[13px] text-muted">ou <span class="text-accent font-semibold">escolha um arquivo</span> · PDF, DOCX ou TXT</div>
      </label>
      <p v-if="error" class="flex gap-2 text-[13px] text-bad"><CircleAlert class="w-4 h-4 shrink-0 mt-0.5" />{{ error }}</p>

      <details class="group" :open="pasteOpen">
        <summary class="flex items-center gap-1.5 text-[13px] font-semibold text-muted cursor-pointer list-none hover:text-ink">
          <ChevronRight class="w-4 h-4 transition-transform group-open:rotate-90" /> Ou cole o texto do currículo
        </summary>
        <textarea v-model="cvText" rows="7" class="input h-auto mt-2 py-2.5 text-[13px] leading-relaxed" placeholder="Cole aqui o texto do seu currículo…"></textarea>
        <button class="btn-primary btn-sm mt-2" :disabled="busy || cvText.trim().length < 30" @click="analyzeText">
          <WandSparkles class="w-4 h-4" /> Analisar texto
        </button>
      </details>

      <div class="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <button class="btn-ghost btn-sm" @click="step = 2">Ainda não tenho currículo: escolher área</button>
        <button class="text-[12px] text-subtle hover:text-ink underline underline-offset-2" @click="skip">Pular e ir direto para a busca</button>
      </div>
    </section>

    <!-- Passo 2: o que buscar -->
    <section v-else class="card p-5 lg:p-6 space-y-5 animate-fade-up" aria-label="O que buscar">
      <div>
        <h2 class="font-semibold text-[16px]">O que vamos buscar</h2>
        <p v-if="profile" class="text-[13px] text-muted mt-0.5">
          Pelo seu currículo: <b class="text-ink">{{ profile.seniority || 'nível não identificado' }}</b><template v-if="profile.areas?.length"> · {{ profile.areas.join(' · ') }}</template>.
          Confira os cargos abaixo.
        </p>
        <p v-else class="text-[13px] text-muted mt-0.5">Escolha uma ou mais áreas. Cada área busca vários cargos parecidos de uma vez.</p>
      </div>

      <div>
        <label class="label">Cargos {{ profile ? 'sugeridos' : '(opcional)' }}</label>
        <UiChipInput v-model="titles" placeholder="Ex: Analista de CRM" add-placeholder="Adicionar cargo…" aria-label="Cargos" />
      </div>

      <div v-if="!profile || areasOpen">
        <span class="label">Áreas</span>
        <div class="space-y-3 max-h-72 overflow-y-auto scroll-thin pr-1">
          <div v-for="g in AREA_GROUPS" :key="g.id" role="group" :aria-label="g.label">
            <div class="text-[12px] font-semibold text-subtle mb-1.5">{{ g.label }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="a in g.areas" :key="a.id" type="button"
                class="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[13px] font-medium transition-colors"
                :class="areas.includes(a.id) ? 'bg-accent-soft border-accent/40 text-accent-ink' : 'border-line text-muted hover:text-ink hover:bg-surface-2'"
                :aria-pressed="areas.includes(a.id)"
                @click="toggleArea(a.id)"
              ><Check v-if="areas.includes(a.id)" class="w-3.5 h-3.5" />{{ a.label }}</button>
            </div>
          </div>
        </div>
      </div>
      <button v-else type="button" class="btn-ghost btn-sm -mt-2" @click="areasOpen = true"><LayoutGrid class="w-4 h-4" /> Somar uma área inteira</button>

      <div class="grid gap-4">
        <div>
          <span class="label">Modalidade</span>
          <div class="segmented" role="group" aria-label="Modalidade">
            <button v-for="o in MODES" :key="o.v" type="button" :aria-pressed="workMode === o.v" @click="workMode = o.v">{{ o.l }}</button>
          </div>
        </div>
        <div>
          <label class="label" for="ob-city">Sua cidade <span class="font-normal text-subtle">(para híbrido e presencial)</span></label>
          <div class="relative">
            <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input id="ob-city" v-model="location" class="input pl-9" placeholder="Ex: Campinas" autocomplete="address-level2" />
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <button class="btn-ghost btn-sm" @click="step = 1"><ChevronLeft class="w-4 h-4" /> Voltar</button>
        <button class="btn-primary h-10 px-5" :disabled="!titles.length && !areas.length" @click="finish">
          <Search class="w-4 h-4" /> Ver minhas vagas
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { CloudUpload, LoaderCircle, CircleAlert, ChevronRight, ChevronLeft, WandSparkles, Check, Search, MapPin, LayoutGrid } from '@lucide/vue';
import { AREA_GROUPS } from '#shared/areas.js';

const emit = defineEmits(['done']);
const { auth, profile, cvText, filters, runSearch, saveUserData } = useJobFinder();
const { busy, busyLabel, error, upload, analyze } = useCvUpload();

const STEPS = ['Currículo', 'O que buscar'];
const MODES = [
  { v: 'remote', l: 'Só remoto' },
  { v: 'remote_hybrid', l: 'Remoto + híbrido' },
  { v: 'any', l: 'Qualquer' },
];
const firstName = computed(() => (auth.value.user?.name || '').trim().split(/\s+/)[0]);

const step = ref(1);
const dragging = ref(false);
const pasteOpen = ref(false);
const areasOpen = ref(false);
const titles = ref([]);
const areas = ref([]);
const workMode = ref(filters.value.workMode || 'remote_hybrid');
const location = ref(filters.value.location || '');

watch(error, (e) => { if (e) pasteOpen.value = true; });

// Currículo lido: os cargos sugeridos já entram na busca
async function afterAnalyze(ok) {
  if (!ok) return;
  titles.value = [...(profile.value?.titles || [])].slice(0, 6);
  step.value = 2;
}
const onPick = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; afterAnalyze(await upload(f)); };
const onDrop = async (e) => { dragging.value = false; afterAnalyze(await upload(e.dataTransfer?.files?.[0])); };
const analyzeText = async () => afterAnalyze(await analyze());

const toggleArea = (id) => { areas.value = areas.value.includes(id) ? areas.value.filter((x) => x !== id) : [...areas.value, id]; };

function finish() {
  filters.value = { ...filters.value, queries: [...titles.value], areas: [...areas.value], workMode: workMode.value, location: location.value.trim(), explore: false };
  emit('done');
  runSearch();
}

// Pular também conta como "já passou pelo primeiro acesso" (os filtros ficam salvos na conta)
function skip() {
  saveUserData({ filters: filters.value });
  emit('done');
}
</script>
