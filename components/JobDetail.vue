<template>
  <div class="p-5 lg:p-6">
    <!-- Cabeçalho -->
    <div class="flex items-start gap-4">
      <UiCompanyAvatar :name="job.company" size="lg" />
      <div class="min-w-0 flex-1">
        <h2 class="text-[19px] font-bold leading-snug">{{ job.title }}</h2>
        <p class="text-muted mt-0.5">{{ job.company }}<span v-if="job.location"> · {{ job.location }}</span></p>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <UiModeBadge :mode="job.mode" />
      <span class="badge-neutral">{{ job.source }}</span>
      <span v-if="ago" class="badge-neutral"><Clock class="w-3.5 h-3.5" />{{ ago }}</span>
      <span v-if="job.applicants != null" class="badge-accent"><Users class="w-3.5 h-3.5" />{{ job.applicants }} candidatos</span>
      <span v-for="t in tags" :key="t" class="badge-neutral">{{ t }}</span>
    </div>

    <!-- Ações -->
    <div class="mt-4 flex flex-wrap gap-2">
      <a :href="job.url" target="_blank" rel="noopener noreferrer" class="btn-primary">
        Ver vaga e candidatar-se <ExternalLink class="w-4 h-4" />
      </a>
      <button class="btn-secondary" @click="toggleSave">
        <BookmarkCheck v-if="saved" class="w-4 h-4 text-accent" /><Bookmark v-else class="w-4 h-4" />
        {{ saved ? 'Salva' : 'Salvar' }}
      </button>
      <button class="btn-secondary" :disabled="letter.loading" @click="genLetter">
        <LoaderCircle v-if="letter.loading" class="w-4 h-4 animate-spin" /><MessageSquare v-else class="w-4 h-4" />
        Mensagem para o recrutador
      </button>
      <button class="btn-ghost" title="Esconde esta vaga das próximas buscas" @click="$emit('hide')">
        <EyeOff class="w-4 h-4" /> Não tenho interesse
      </button>
    </div>

    <!-- Match -->
    <section class="mt-6 rounded-2xl border border-line bg-surface-2/50 p-4" aria-label="Compatibilidade">
      <template v-if="profile">
        <div class="flex items-center gap-4">
          <UiScoreRing :value="ai.result?.score ?? job.matchScore ?? 0" size="lg" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold">{{ verdict }}</div>
            <p class="text-[13px] text-muted mt-0.5">
              <template v-if="ai.result">{{ ai.result.summary }}</template>
              <template v-else-if="job.matchedSkills?.length">Seu currículo cita: {{ job.matchedSkills.join(', ') }}.</template>
              <template v-else>Nenhuma habilidade do seu currículo aparece no texto da vaga.</template>
            </p>
          </div>
        </div>

        <div v-if="ai.result" class="mt-4 grid gap-3 sm:grid-cols-2 animate-fade-up">
          <div>
            <div class="flex items-center gap-1.5 text-[12px] font-semibold text-ok mb-1.5"><CircleCheck class="w-4 h-4" /> Pontos fortes</div>
            <ul class="space-y-1 text-[13px]"><li v-for="s in ai.result.strengths || []" :key="s" class="flex gap-2"><span class="text-subtle">•</span>{{ s }}</li></ul>
          </div>
          <div>
            <div class="flex items-center gap-1.5 text-[12px] font-semibold text-warn mb-1.5"><TriangleAlert class="w-4 h-4" /> Pode faltar</div>
            <ul class="space-y-1 text-[13px]"><li v-for="g in ai.result.gaps || []" :key="g" class="flex gap-2"><span class="text-subtle">•</span>{{ g }}</li></ul>
          </div>
          <div v-if="ai.result.tips" class="sm:col-span-2 flex gap-2 p-3 rounded-xl bg-accent-soft/60 text-[13px]">
            <Lightbulb class="w-4 h-4 text-accent shrink-0 mt-0.5" /><span>{{ ai.result.tips }}</span>
          </div>
          <p class="sm:col-span-2 text-[12px] text-subtle">{{ ai.result.provider === 'local' ? 'Análise local (sem IA). Configure uma chave em Ajustes para uma análise mais completa.' : `Análise feita por ${ai.result.provider}.` }}</p>
        </div>

        <button v-if="!ai.result" class="btn-secondary btn-sm mt-3" :disabled="ai.loading" @click="analyze">
          <LoaderCircle v-if="ai.loading" class="w-4 h-4 animate-spin" /><WandSparkles v-else class="w-4 h-4" />
          {{ ai.loading ? 'Analisando requisitos…' : 'Análise detalhada dos requisitos' }}
        </button>
      </template>
      <div v-else class="flex items-center gap-3">
        <FileUser class="w-6 h-6 text-accent shrink-0" />
        <p class="flex-1 text-[13px] text-muted">Envie seu currículo para ver a compatibilidade com esta vaga.</p>
        <button class="btn-secondary btn-sm" @click="$emit('go', 'profile')">Enviar currículo</button>
      </div>
    </section>

    <!-- Mensagem / carta -->
    <section v-if="letter.result" class="mt-4 space-y-3 animate-fade-up" aria-label="Mensagens para o recrutador">
      <div class="rounded-2xl border border-line p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[12px] font-semibold text-muted">Convite de conexão no LinkedIn <span class="text-subtle font-normal">· {{ (letter.result.linkedin_note || '').length }}/300</span></span>
          <button class="btn-ghost btn-sm" @click="copy(letter.result.linkedin_note, 'note')"><Check v-if="copied === 'note'" class="w-4 h-4 text-ok" /><Copy v-else class="w-4 h-4" /> Copiar</button>
        </div>
        <p class="text-[14px] whitespace-pre-line">{{ letter.result.linkedin_note }}</p>
      </div>
      <div class="rounded-2xl border border-line p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[12px] font-semibold text-muted">Carta de apresentação</span>
          <button class="btn-ghost btn-sm" @click="copy(letter.result.cover_letter, 'letter')"><Check v-if="copied === 'letter'" class="w-4 h-4 text-ok" /><Copy v-else class="w-4 h-4" /> Copiar</button>
        </div>
        <p class="text-[14px] whitespace-pre-line">{{ letter.result.cover_letter }}</p>
      </div>
    </section>

    <!-- Descrição -->
    <section class="mt-6" aria-label="Descrição da vaga">
      <h3 class="text-[13px] font-semibold text-muted mb-2">Descrição da vaga</h3>
      <div v-if="desc.loading" class="space-y-2"><div v-for="i in 4" :key="i" class="h-3 rounded bg-surface-2 animate-pulse" :style="{ width: 100 - i * 12 + '%' }"></div></div>
      <template v-else-if="paragraphs.length">
        <div class="relative" :class="!desc.expanded && longDesc ? 'max-h-72 overflow-hidden' : ''">
          <p v-for="(p, i) in paragraphs" :key="i" class="text-[14px] leading-relaxed text-ink/90 mb-2.5">{{ p }}</p>
          <div v-if="!desc.expanded && longDesc" class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent"></div>
        </div>
        <button v-if="longDesc" class="btn-ghost btn-sm mt-1" @click="desc.expanded = !desc.expanded">
          {{ desc.expanded ? 'Mostrar menos' : 'Ler descrição completa' }} <ChevronDown class="w-4 h-4 transition-transform" :class="desc.expanded && 'rotate-180'" />
        </button>
      </template>
      <p v-else class="text-[13px] text-muted">Esta fonte não fornece a descrição. Abra a vaga no site original.</p>
    </section>
  </div>
</template>

<script setup>
import {
  ExternalLink, Bookmark, BookmarkCheck, MessageSquare, LoaderCircle, Clock, Users, CircleCheck, TriangleAlert,
  Lightbulb, WandSparkles, FileUser, Copy, Check, ChevronDown, EyeOff,
} from '@lucide/vue';

const props = defineProps({ job: { type: Object, required: true } });
defineEmits(['go', 'hide']);

const { profile, cvText, savedByUrl, saveJob, removeSaved, toast, aiHeaders, checkKeyError } = useJobFinder();

const ai = reactive({ loading: false, result: null });
const letter = reactive({ loading: false, result: null });
const desc = reactive({ loading: false, text: '', expanded: false });
const copied = ref('');

const ago = computed(() => timeAgo(props.job.date));
const saved = computed(() => savedByUrl.value.has(props.job.url));
const tags = computed(() => [...new Set(props.job.tags || [])].filter((t) => t && t.length < 30).slice(0, 4));
const verdict = computed(() => {
  const s = ai.result?.score ?? props.job.matchScore ?? 0;
  return s >= 70 ? 'Combina muito com você' : s >= 45 ? 'Combina em parte' : 'Pouca compatibilidade';
});

// Quebra o texto corrido em parágrafos legíveis (as fontes entregam a descrição sem formatação)
const paragraphs = computed(() => {
  const t = (desc.text || '').replace(/\s*[•●▪◦]\s*/g, '\n• ').replace(/([.!?:])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ•])/g, '$1\n');
  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && !l.startsWith('•') && !/[:]$/.test(last) && last.length + l.length < 260 && !last.startsWith('•')) out[out.length - 1] = last + ' ' + l;
    else out.push(l);
  }
  return out;
});
const longDesc = computed(() => (desc.text || '').length > 900);

async function loadDescription() {
  desc.text = props.job.desc || '';
  desc.expanded = false;
  if (desc.text.length >= 1200) return;
  const url = props.job.url;
  desc.loading = !desc.text;
  try {
    const r = await $fetch('/api/job/description', { method: 'POST', body: { job: props.job } });
    if (props.job.url === url && (r.desc || '').length > desc.text.length) desc.text = r.desc;
  } catch {} finally {
    if (props.job.url === url) desc.loading = false;
  }
}

watch(() => props.job.url, () => {
  ai.result = null; ai.loading = false;
  letter.result = null; letter.loading = false;
  loadDescription();
}, { immediate: true });

async function analyze() {
  const url = props.job.url;
  ai.loading = true;
  try {
    const r = checkKeyError(await $fetch('/api/ai/match', { method: 'POST', headers: aiHeaders(), body: { job: { ...props.job, desc: desc.text }, cvText: cvText.value, analysis: profile.value } }));
    if (props.job.url === url) ai.result = r;
  } catch (err) {
    toast('Não consegui analisar: ' + (err?.data?.message || err.message), 'bad');
  } finally {
    if (props.job.url === url) ai.loading = false;
  }
}

async function genLetter() {
  if (!cvText.value) { toast('Envie seu currículo primeiro para personalizar a mensagem', 'bad'); return; }
  const url = props.job.url;
  letter.loading = true;
  try {
    const r = checkKeyError(await $fetch('/api/ai/cover-letter', { method: 'POST', headers: aiHeaders(), body: { job: { ...props.job, desc: desc.text }, cvText: cvText.value, analysis: profile.value } }));
    if (props.job.url === url) letter.result = r;
  } catch (err) {
    toast('Não consegui gerar: ' + (err?.data?.message || err.message), 'bad');
  } finally {
    if (props.job.url === url) letter.loading = false;
  }
}

async function toggleSave() {
  const s = savedByUrl.value.get(props.job.url);
  if (s) { await removeSaved(s.application_id); toast('Removida das candidaturas'); }
  else if (await saveJob(props.job)) toast('Salva nas candidaturas');
}

async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text || '');
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = ''; }, 1500);
  } catch { toast('Não foi possível copiar', 'bad'); }
}
</script>
