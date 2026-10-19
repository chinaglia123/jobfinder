<template>
  <div class="px-4 lg:px-8 py-6 lg:py-10 max-w-2xl mx-auto">
    <header class="mb-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Boas-vindas{{ firstName ? `, ${firstName}` : '' }}!</h1>
          <p class="text-muted mt-1">Configure sua busca rápida ou pule qualquer etapa quando quiser.</p>
        </div>
        <button type="button" class="btn-secondary btn-sm shrink-0" @click="skip">
          Pular e ir para a busca <ArrowRight class="w-4 h-4" />
        </button>
      </div>

      <ol class="mt-4 flex flex-wrap items-center gap-2 text-[13px] font-semibold" aria-label="Passos">
        <li v-for="(s, i) in STEPS" :key="s" class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-2 hover:text-ink transition-colors"
            :class="step === i + 1 ? 'text-ink' : isStepDone(i + 1) ? 'text-ok' : 'text-subtle'"
            :aria-current="step === i + 1 ? 'step' : undefined"
            @click="step = i + 1"
          >
            <span class="grid place-items-center w-6 h-6 rounded-full text-[12px]" :class="step === i + 1 ? 'bg-accent text-white dark:text-bg' : isStepDone(i + 1) ? 'bg-ok-soft text-ok' : 'bg-surface-2'">
              <Check v-if="isStepDone(i + 1) && step !== i + 1" class="w-3.5 h-3.5" /><template v-else>{{ i + 1 }}</template>
            </span>
            {{ s }}
          </button>
          <ChevronRight v-if="i < STEPS.length - 1" class="w-4 h-4 text-subtle" />
        </li>
      </ol>
    </header>

    <!-- Passo 1: Chave de IA (grátis) -->
    <section v-if="step === 1" class="card p-5 lg:p-6 space-y-4 animate-fade-up" aria-label="Configurar chave de IA">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" :class="aiKey?.key ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'">
          <KeyRound class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-[16px]">Ative sua IA gratuita</h2>
            <span v-if="aiKey?.key" class="badge-ok">Ativa · {{ PROVIDER_INFO[aiKey.provider]?.name }}</span>
            <span v-else class="badge-accent">Recomendado · 100% grátis</span>
          </div>
          <p class="text-[13px] text-muted mt-0.5">
            Com uma chave gratuita (leva 30 segundos), a leitura do seu currículo, o cálculo de match e o gerador de currículo sob medida usam Inteligência Artificial completa. A chave fica salva <b>só no seu navegador</b>.
          </p>
        </div>
      </div>

      <div v-if="aiKey?.key && !editingKey" class="flex flex-wrap items-center gap-2 p-3.5 rounded-xl bg-surface-2/60 text-[13px]">
        <CircleCheck class="w-4 h-4 text-ok shrink-0" />
        <span class="flex-1 min-w-0 truncate">
          Chave <b>{{ PROVIDER_INFO[aiKey.provider]?.name }}</b> configurada (<code class="font-mono">…{{ aiKey.key.slice(-4) }}</code>)
        </span>
        <button type="button" class="btn-ghost btn-sm" @click="editingKey = true">Trocar chave</button>
        <button type="button" class="btn-primary btn-sm" @click="step = 2">Continuar <ChevronRight class="w-4 h-4" /></button>
      </div>

      <form v-else class="space-y-3.5" @submit.prevent="testAndSaveKey">
        <div>
          <span class="label">Escolha o provedor gratuito</span>
          <div class="segmented w-full sm:w-auto" role="group" aria-label="Provedor de IA">
            <button v-for="(p, id) in PROVIDER_INFO" :key="id" type="button" :aria-pressed="keyForm.provider === id" @click="keyForm.provider = id">{{ p.name }}</button>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-surface-2/70 border border-line flex flex-wrap items-center justify-between gap-3">
          <div class="text-[13px]">
            <div class="font-semibold text-ink">1. Gere sua chave gratuita ({{ PROVIDER_INFO[keyForm.provider].name }})</div>
            <div class="text-muted text-[12px] mt-0.5">{{ PROVIDER_INFO[keyForm.provider].steps }}</div>
          </div>
          <a
            :href="PROVIDER_INFO[keyForm.provider].url"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-secondary btn-sm shrink-0"
          >
            Gerar chave na {{ PROVIDER_INFO[keyForm.provider].name }} <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>

        <div>
          <label class="label" for="ob-aikey">2. Cole sua chave aqui</label>
          <div class="relative">
            <input
              id="ob-aikey"
              v-model.trim="keyForm.key"
              :type="showKey ? 'text' : 'password'"
              class="input pr-10 font-mono text-[13px]"
              :placeholder="PROVIDER_INFO[keyForm.provider].placeholder"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <button
              type="button"
              class="absolute right-1 top-1/2 -translate-y-1/2 btn-icon btn-ghost h-8 w-8 text-subtle hover:text-ink"
              :aria-label="showKey ? 'Esconder chave' : 'Mostrar chave'"
              @click="showKey = !showKey"
            >
              <EyeOff v-if="showKey" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <p v-if="keyMsg" class="flex gap-2 text-[13px]" :class="keyOk ? 'text-ok' : 'text-bad'">
          <CircleCheck v-if="keyOk" class="w-4 h-4 shrink-0 mt-0.5" /><CircleAlert v-else class="w-4 h-4 shrink-0 mt-0.5" />{{ keyMsg }}
        </p>

        <div class="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="btn-secondary btn-sm" @click="step = 2">
            Pular chave por enquanto <ChevronRight class="w-4 h-4" />
          </button>
          <button type="submit" class="btn-primary h-10 px-5" :disabled="testingKey || !keyForm.key">
            <LoaderCircle v-if="testingKey" class="w-4 h-4 animate-spin" />
            <PlugZap v-else class="w-4 h-4" />
            {{ testingKey ? 'Testando chave…' : 'Salvar chave e continuar' }}
          </button>
        </div>
      </form>
    </section>

    <!-- Passo 2: currículo -->
    <section v-else-if="step === 2" class="card p-5 lg:p-6 space-y-4 animate-fade-up" aria-label="Enviar currículo">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-[16px]">Envie seu currículo <span class="text-subtle font-normal text-[13px]">(opcional)</span></h2>
            <span v-if="aiKey?.key" class="badge-ok">IA {{ PROVIDER_INFO[aiKey.provider]?.name }} ativa</span>
          </div>
          <p class="text-[13px] text-muted mt-0.5">Lemos seu nível, os cargos que combinam com você e suas habilidades. Assim cada vaga ganha uma nota de match.</p>
        </div>
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

      <div class="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="btn-ghost btn-sm" @click="step = 1">
          <ChevronLeft class="w-4 h-4" /> Voltar (Chave de IA)
        </button>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ghost btn-sm" @click="skip">
            Ir direto para a busca
          </button>
          <button type="button" class="btn-secondary btn-sm" @click="step = 3">
            Pular currículo e escolher área <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>

    <!-- Passo 3: o que buscar -->
    <section v-else class="card p-5 lg:p-6 space-y-5 animate-fade-up" aria-label="O que buscar">
      <div>
        <h2 class="font-semibold text-[16px]">O que vamos buscar</h2>
        <p v-if="profile" class="text-[13px] text-muted mt-0.5">
          Pelo seu currículo: <b class="text-ink">{{ profile.seniority || 'nível não identificado' }}</b><template v-if="profile.areas?.length"> · {{ profile.areas.join(' · ') }}</template>.
          Confira os cargos abaixo.
        </p>
        <p v-else class="text-[13px] text-muted mt-0.5">Escolha uma ou mais áreas, digite cargos específicos ou explore todas as vagas.</p>
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
            <input id="ob-city" v-model="location" class="input pl-9" placeholder="Ex: Sorocaba" autocomplete="address-level2" />
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="btn-ghost btn-sm" @click="step = 2"><ChevronLeft class="w-4 h-4" /> Voltar</button>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="!titles.length && !areas.length" type="button" class="btn-secondary h-10 px-4" @click="finishExplore">
            Explorar todas as vagas
          </button>
          <button type="button" class="btn-primary h-10 px-5" :disabled="!titles.length && !areas.length" @click="finish">
            <Search class="w-4 h-4" /> Ver minhas vagas
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { CloudUpload, LoaderCircle, CircleAlert, CircleCheck, ChevronRight, ChevronLeft, WandSparkles, Check, Search, MapPin, LayoutGrid, KeyRound, ExternalLink, Eye, EyeOff, PlugZap, ArrowRight } from '@lucide/vue';
import { AREA_GROUPS } from '#shared/areas.js';

const emit = defineEmits(['done']);
const { auth, profile, cvText, filters, runSearch, saveUserData, aiKey, setAiKey, aiHeaders, toast } = useJobFinder();
const { busy, busyLabel, error, upload, analyze } = useCvUpload();

const STEPS = ['Chave de IA', 'Currículo', 'O que buscar'];
const MODES = [
  { v: 'remote', l: 'Só remoto' },
  { v: 'remote_hybrid', l: 'Remoto + híbrido' },
  { v: 'any', l: 'Qualquer' },
];
const PROVIDER_INFO = {
  groq: {
    name: 'Groq',
    placeholder: 'gsk_…',
    url: 'https://console.groq.com/keys',
    steps: 'Entre com sua conta Google/GitHub, clique em "Create API Key" e copie a chave gerada.',
  },
  gemini: {
    name: 'Gemini',
    placeholder: 'AIza…',
    url: 'https://aistudio.google.com/apikey',
    steps: 'No Google AI Studio, clique em "Create API key" e copie o código.',
  },
  openrouter: {
    name: 'OpenRouter',
    placeholder: 'sk-or-…',
    url: 'https://openrouter.ai/keys',
    steps: 'Crie uma conta gratuita no OpenRouter, gere uma Key e cole abaixo.',
  },
};

const firstName = computed(() => (auth.value.user?.name || '').trim().split(/\s+/)[0]);

// Se já tiver chave salva neste navegador, começa direto no passo 2 (Currículo)
const step = ref(aiKey.value?.key ? 2 : 1);
const editingKey = ref(false);
const showKey = ref(false);
const testingKey = ref(false);
const keyMsg = ref('');
const keyOk = ref(false);
const keyForm = reactive({ provider: aiKey.value?.provider || 'groq', key: '' });

const dragging = ref(false);
const pasteOpen = ref(false);
const areasOpen = ref(false);
const titles = ref([]);
const areas = ref([]);
const workMode = ref(filters.value.workMode || 'remote_hybrid');
const location = ref(filters.value.location || '');

function isStepDone(s) {
  if (s === 1) return Boolean(aiKey.value?.key);
  if (s === 2) return Boolean(profile.value);
  return false;
}

async function testAndSaveKey() {
  testingKey.value = true;
  keyMsg.value = '';
  const candidate = { provider: keyForm.provider, key: keyForm.key };
  try {
    const r = await $fetch('/api/ai/test', { method: 'POST', headers: aiHeaders(candidate) });
    setAiKey(candidate);
    keyOk.value = true;
    keyMsg.value = `Funcionou! Usando ${r.label} (${r.model}).`;
    editingKey.value = false;
    keyForm.key = '';
    toast('Chave de IA configurada com sucesso!');
    step.value = 2;
  } catch (err) {
    keyOk.value = false;
    keyMsg.value = err?.data?.message || err.message;
  } finally {
    testingKey.value = false;
  }
}

watch(error, (e) => { if (e) pasteOpen.value = true; });

// Currículo lido: os cargos sugeridos já entram na busca
async function afterAnalyze(ok) {
  if (!ok) return;
  titles.value = [...(profile.value?.titles || [])].slice(0, 6);
  step.value = 3;
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

function finishExplore() {
  filters.value = { ...filters.value, workMode: workMode.value, location: location.value.trim(), explore: true };
  saveUserData({ filters: filters.value });
  emit('done');
  runSearch();
}

// Pular também conta como "já passou pelo primeiro acesso" (os filtros ficam salvos na conta)
function skip() {
  saveUserData({ filters: filters.value });
  emit('done');
}
</script>
