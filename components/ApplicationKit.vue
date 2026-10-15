<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[55] flex lg:items-center lg:justify-center lg:p-6">
      <div class="absolute inset-0 bg-black/40" @click="$emit('close')"></div>
      <div
        class="relative flex flex-col w-full lg:max-w-5xl h-full lg:h-[92vh] bg-surface lg:rounded-2xl lg:border lg:border-line shadow-pop animate-fade-up"
        role="dialog" aria-modal="true" :aria-label="`Preparar candidatura: ${job.title}`"
      >
        <!-- Cabeçalho -->
        <div class="flex items-center gap-3 px-4 lg:px-6 h-16 border-b border-line shrink-0">
          <UiCompanyAvatar :name="job.company" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold truncate">Candidatura para {{ job.title }}</div>
            <div class="text-[12px] text-muted truncate">{{ job.company }}</div>
          </div>
          <button class="btn-icon btn-ghost" aria-label="Fechar" @click="$emit('close')"><X class="w-5 h-5" /></button>
        </div>

        <!-- Sem currículo -->
        <div v-if="!cvText" class="flex-1 grid place-items-center p-8 text-center">
          <div>
            <FileUser class="w-10 h-10 mx-auto mb-3 text-subtle" />
            <p class="font-semibold">Envie seu currículo primeiro</p>
            <p class="text-[13px] text-muted mt-1">O currículo sob medida parte do seu currículo real.</p>
            <button class="btn-primary mt-4" @click="$emit('go', 'profile')">Ir para Meu currículo</button>
          </div>
        </div>

        <template v-else>
          <div class="px-4 lg:px-6 pt-3 shrink-0">
            <div class="segmented" role="tablist" aria-label="Partes da candidatura">
              <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-pressed="tab === t.id" :aria-selected="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto scroll-thin px-4 lg:px-6 py-4">
            <!-- Carregando -->
            <div v-if="tab === 'cv' && cvState.loading" class="py-16 text-center text-muted">
              <LoaderCircle class="w-6 h-6 animate-spin mx-auto mb-2" />
              Adaptando seu currículo aos requisitos da vaga…
            </div>
            <p v-else-if="tab === 'cv' && cvState.error" class="text-bad text-[13px]">{{ cvState.error }}</p>

            <!-- Currículo -->
            <div v-else-if="tab === 'cv' && cv" class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div class="space-y-4">
                <p v-if="cv.provider === 'local'" class="flex gap-2 p-3 rounded-xl bg-warn-soft text-[13px]">
                  <TriangleAlert class="w-4 h-4 text-warn shrink-0 mt-0.5" />
                  Versão básica (sem IA): só reordenamos suas competências. Com uma chave de IA em Ajustes, o currículo inteiro é reescrito para a vaga.
                </p>
                <div class="grid sm:grid-cols-2 gap-3">
                  <div><label class="label" for="ak-name">Nome</label><input id="ak-name" v-model="cv.name" class="input" /></div>
                  <div><label class="label" for="ak-head">Título</label><input id="ak-head" v-model="cv.headline" class="input" /></div>
                </div>
                <div><label class="label" for="ak-contact">Contato</label><input id="ak-contact" v-model="cv.contact" class="input" /></div>
                <div v-if="cv.summary !== undefined && (cv.summary || cv.provider !== 'local')">
                  <label class="label" for="ak-sum">Resumo</label>
                  <textarea id="ak-sum" v-model="cv.summary" rows="4" class="input h-auto py-2.5 leading-relaxed"></textarea>
                </div>
                <div>
                  <label class="label">Competências <span class="font-normal text-subtle">(as mais pedidas pela vaga primeiro)</span></label>
                  <UiChipInput v-model="cv.skills" add-placeholder="Adicionar…" aria-label="Competências" />
                </div>
                <div v-for="(e, i) in cv.experience" :key="i" class="rounded-2xl border border-line p-3.5 space-y-2">
                  <div class="grid sm:grid-cols-[1fr_1fr_140px] gap-2">
                    <input v-model="e.role" class="input h-9 text-[13px] font-semibold" aria-label="Cargo" />
                    <input v-model="e.company" class="input h-9 text-[13px]" aria-label="Empresa" />
                    <input v-model="e.period" class="input h-9 text-[13px]" aria-label="Período" />
                  </div>
                  <textarea
                    :value="(e.bullets || []).join('\n')" rows="4"
                    class="input h-auto py-2 text-[13px] leading-relaxed" aria-label="Atividades (uma por linha)"
                    @input="e.bullets = $event.target.value.split('\n').map((l) => l.trim()).filter(Boolean)"
                  ></textarea>
                </div>
                <div v-for="f in LIST_FIELDS" :key="f.key">
                  <template v-if="cv[f.key]?.length">
                    <label class="label">{{ f.label }} <span class="font-normal text-subtle">(uma por linha)</span></label>
                    <textarea :value="cv[f.key].join('\n')" rows="2" class="input h-auto py-2 text-[13px]" :aria-label="f.label"
                      @input="cv[f.key] = $event.target.value.split('\n').map((l) => l.trim()).filter(Boolean)"></textarea>
                  </template>
                </div>
                <details v-if="cv.rawText" class="group">
                  <summary class="text-[13px] font-semibold text-muted cursor-pointer">Texto original incluído no arquivo</summary>
                  <textarea v-model="cv.rawText" rows="10" class="input h-auto mt-2 py-2 text-[12px] font-mono"></textarea>
                </details>
              </div>

              <!-- Painel lateral: cobertura da vaga -->
              <aside class="space-y-4 text-[13px]">
                <div v-if="cv.warnings?.length" class="p-3 rounded-xl bg-bad-soft space-y-1">
                  <div class="font-semibold text-bad flex items-center gap-1.5"><ShieldCheck class="w-4 h-4" /> Revisamos para você</div>
                  <p v-for="w in cv.warnings" :key="w">{{ w }}</p>
                </div>
                <div v-if="cv.keywords_covered?.length">
                  <div class="font-semibold text-ok mb-1.5 flex items-center gap-1.5"><CircleCheck class="w-4 h-4" /> A vaga pede e você tem</div>
                  <div class="flex flex-wrap gap-1"><span v-for="k in cv.keywords_covered" :key="k" class="badge-ok">{{ k }}</span></div>
                </div>
                <div v-if="cv.keywords_missing?.length">
                  <div class="font-semibold text-warn mb-1.5 flex items-center gap-1.5"><TriangleAlert class="w-4 h-4" /> A vaga pede e não está no CV</div>
                  <div class="flex flex-wrap gap-1"><span v-for="k in cv.keywords_missing" :key="k" class="badge-warn">{{ k }}</span></div>
                  <p class="text-subtle mt-1.5">Só acrescente se você realmente tiver essa experiência.</p>
                </div>
                <div v-if="cv.tips?.length" class="p-3 rounded-xl bg-accent-soft/60 space-y-1.5">
                  <div class="font-semibold flex items-center gap-1.5"><Lightbulb class="w-4 h-4 text-accent" /> Dicas</div>
                  <p v-for="t in cv.tips" :key="t">{{ t }}</p>
                </div>
                <p class="text-[12px] text-subtle">Revise antes de enviar. A IA foi instruída a não inventar nada, mas pode errar.</p>
              </aside>
            </div>

            <!-- Carta e mensagem -->
            <template v-else-if="tab === 'letter' || tab === 'note'">
              <div v-if="letterState.loading" class="py-16 text-center text-muted"><LoaderCircle class="w-6 h-6 animate-spin mx-auto mb-2" />Escrevendo…</div>
              <div v-else-if="letterState.data" class="space-y-2 max-w-3xl">
                <label class="label" :for="`ak-${tab}`">{{ tab === 'letter' ? 'Carta de apresentação' : 'Convite de conexão no LinkedIn' }}
                  <span v-if="tab === 'note'" class="font-normal text-subtle">· {{ (letterState.data.linkedin_note || '').length }}/300</span></label>
                <textarea v-if="tab === 'letter'" id="ak-letter" v-model="letterState.data.cover_letter" rows="14" class="input h-auto py-3 leading-relaxed"></textarea>
                <textarea v-else id="ak-note" v-model="letterState.data.linkedin_note" rows="5" class="input h-auto py-3 leading-relaxed"></textarea>
                <button class="btn-secondary btn-sm" @click="copy(tab === 'letter' ? letterState.data.cover_letter : letterState.data.linkedin_note, tab)">
                  <Check v-if="copied === tab" class="w-4 h-4 text-ok" /><Copy v-else class="w-4 h-4" /> Copiar
                </button>
              </div>
            </template>
          </div>

          <!-- Ações -->
          <div class="flex flex-wrap items-center gap-2 px-4 lg:px-6 py-3 border-t border-line shrink-0">
            <button class="btn-secondary" :disabled="!cv || !!exporting" @click="exportAs('pdf')">
              <LoaderCircle v-if="exporting === 'pdf'" class="w-4 h-4 animate-spin" /><FileDown v-else class="w-4 h-4" /> Baixar PDF
            </button>
            <button class="btn-secondary" :disabled="!cv || !!exporting" @click="exportAs('docx')">
              <LoaderCircle v-if="exporting === 'docx'" class="w-4 h-4 animate-spin" /><FileDown v-else class="w-4 h-4" /> Baixar DOCX
            </button>
            <button class="btn-ghost" :disabled="!cv" @click="copy(cvToText(cv), 'cv')">
              <Check v-if="copied === 'cv'" class="w-4 h-4 text-ok" /><Copy v-else class="w-4 h-4" /> Copiar texto
            </button>
            <button class="btn-primary ml-auto" @click="applyNow">
              Abrir vaga e marcar como candidatada <ExternalLink class="w-4 h-4" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { X, FileUser, LoaderCircle, TriangleAlert, ShieldCheck, CircleCheck, Lightbulb, Copy, Check, FileDown, ExternalLink } from '@lucide/vue';
import { cvToText, cvFileName, downloadPdf, downloadDocx } from '~/composables/cvExport.js';

const props = defineProps({ job: { type: Object, required: true }, open: { type: Boolean, default: false } });
const emit = defineEmits(['close', 'go']);
const { cvText, profile, aiHeaders, checkKeyError, saveJob, toast } = useJobFinder();

const TABS = [{ id: 'cv', label: 'Currículo' }, { id: 'letter', label: 'Carta' }, { id: 'note', label: 'Mensagem LinkedIn' }];
const LIST_FIELDS = [{ key: 'education', label: 'Formação' }, { key: 'certifications', label: 'Cursos e certificações' }, { key: 'languages', label: 'Idiomas' }];

const tab = ref('cv');
const cv = ref(null);
const cvState = reactive({ loading: false, error: '' });
const letterState = reactive({ loading: false, data: null });
const exporting = ref('');
const copied = ref('');

// Fica guardado por vaga enquanto a página estiver aberta (reabrir não gera de novo)
const cache = useState('applicationKitCache', () => ({}));

async function prepare() {
  const url = props.job.url;
  const cached = cache.value[url];
  if (cached) { cv.value = cached.cv; letterState.data = cached.letter; return; }
  cv.value = null;
  letterState.data = null;
  cvState.loading = true; cvState.error = '';
  letterState.loading = true;
  const body = { job: props.job, cvText: cvText.value, profile: profile.value, analysis: profile.value };
  const [c, l] = await Promise.allSettled([
    $fetch('/api/ai/tailor-cv', { method: 'POST', headers: aiHeaders(), body }),
    $fetch('/api/ai/cover-letter', { method: 'POST', headers: aiHeaders(), body }),
  ]);
  if (props.job.url !== url) return;
  if (c.status === 'fulfilled') cv.value = checkKeyError(c.value);
  else cvState.error = c.reason?.data?.message || c.reason?.message || 'Não foi possível preparar o currículo.';
  if (l.status === 'fulfilled') letterState.data = l.value;
  cvState.loading = false;
  letterState.loading = false;
  cache.value = { ...cache.value, [url]: { cv: cv.value, letter: letterState.data } };
}

watch(() => [props.open, props.job.url], ([o]) => { if (o && cvText.value) { tab.value = 'cv'; prepare(); } }, { immediate: true });

async function exportAs(kind) {
  exporting.value = kind;
  try {
    // Cópia simples: as bibliotecas alteram os objetos que recebem, e o currículo da tela é reativo
    const plain = JSON.parse(JSON.stringify(cv.value));
    const name = cvFileName(plain, props.job, kind);
    const work = kind === 'pdf' ? downloadPdf(plain, name) : downloadDocx(plain, name);
    await Promise.race([work, new Promise((_, reject) => setTimeout(() => reject(new Error('demorou demais, tente de novo')), 60000))]);
    toast(`${kind.toUpperCase()} baixado`);
  } catch (err) {
    toast('Não consegui gerar o arquivo: ' + err.message, 'bad');
  } finally {
    exporting.value = '';
  }
}

async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text || '');
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = ''; }, 1500);
  } catch { toast('Não foi possível copiar', 'bad'); }
}

async function applyNow() {
  window.open(props.job.url, '_blank', 'noopener');
  if (await saveJob(props.job, 'applied')) toast('Marcada como "Candidatei-me" no funil');
}
</script>
