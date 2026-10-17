<template>
  <div class="px-4 lg:px-8 py-5 lg:py-7 max-w-5xl mx-auto">
    <header class="mb-5">
      <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Meu currículo</h1>
      <p class="text-muted mt-1">Usamos seu currículo para sugerir cargos e calcular o quanto cada vaga combina com você. {{ auth.mode === 'hosted' ? 'Ele fica na sua conta e só você vê.' : 'Ele fica salvo só neste computador.' }}</p>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      <!-- Envio -->
      <section class="card p-5 space-y-4" aria-label="Enviar currículo">
        <label
          class="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors"
          :class="dragging ? 'border-accent bg-accent-soft/50' : 'border-line hover:border-accent/50 hover:bg-surface-2/60'"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <input type="file" accept=".pdf,.docx,.txt,application/pdf" class="sr-only" @change="onPick" />
          <div class="w-12 h-12 rounded-2xl bg-accent-soft text-accent grid place-items-center">
            <LoaderCircle v-if="busy" class="w-6 h-6 animate-spin" />
            <CloudUpload v-else class="w-6 h-6" />
          </div>
          <div class="font-semibold">{{ busy ? busyLabel : 'Arraste seu currículo aqui' }}</div>
          <div class="text-[13px] text-muted">ou <span class="text-accent font-semibold">escolha um arquivo</span> · PDF, DOCX ou TXT até 8 MB</div>
        </label>

        <p v-if="error" class="flex gap-2 text-[13px] text-bad"><CircleAlert class="w-4 h-4 shrink-0 mt-0.5" />{{ error }}</p>
        <p v-if="fileName && !error" class="flex items-center gap-2 text-[13px] text-muted"><FileText class="w-4 h-4" />{{ fileName }} · {{ cvText.length.toLocaleString('pt-BR') }} caracteres lidos</p>

        <details class="group" :open="!cvText || showText">
          <summary class="flex items-center gap-1.5 text-[13px] font-semibold text-muted cursor-pointer list-none hover:text-ink">
            <ChevronRight class="w-4 h-4 transition-transform group-open:rotate-90" /> {{ cvText ? 'Ver ou editar o texto do currículo' : 'Ou cole o texto do currículo' }}
          </summary>
          <textarea
            v-model="cvText"
            rows="10"
            class="input h-auto mt-2 py-2.5 text-[13px] leading-relaxed font-mono"
            placeholder="Cole aqui o texto completo do seu currículo (português ou inglês)…"
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[12px] text-subtle">{{ cvText.length.toLocaleString('pt-BR') }} caracteres</span>
            <button class="btn-primary btn-sm" :disabled="busy || cvText.trim().length < 30" @click="analyze()">
              <WandSparkles class="w-4 h-4" /> Analisar texto
            </button>
          </div>
        </details>
      </section>

      <!-- Perfil -->
      <section v-if="profile" class="card p-5 space-y-5 animate-fade-up" aria-label="Perfil identificado">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <input v-model="profile.name" class="text-[18px] font-bold bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-accent/20 rounded-lg -ml-1 px-1" aria-label="Nome" />
            <p class="text-[13px] text-muted mt-0.5">
              {{ (profile.areas || []).join(' · ') || 'Área não identificada' }}
            </p>
          </div>
          <span class="badge-neutral shrink-0" :title="profile.source === 'local' ? 'Configure uma chave de IA em Ajustes para uma análise melhor' : ''">
            {{ profile.source === 'local' ? 'Análise local' : `IA: ${profile.source}` }}
          </span>
        </div>

        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="label" for="lvl">Nível de experiência</label>
            <select id="lvl" v-model="profile.seniority" class="select">
              <option v-for="l in LEVELS" :key="l" :value="l">{{ l[0].toUpperCase() + l.slice(1) }}</option>
            </select>
          </div>
          <div>
            <label class="label" for="lang">Idioma do currículo</label>
            <select id="lang" v-model="profile.language" class="select">
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">Cargos que você busca</label>
          <UiChipInput v-model="profile.titles" placeholder="Ex: Analista de Marketing Digital" add-placeholder="Adicionar cargo…" aria-label="Cargos que você busca" />
          <p class="text-[12px] text-subtle mt-1.5">Sugeridos a partir do currículo. Ajuste à vontade: são usados na busca e no match.</p>
        </div>

        <div>
          <label class="label">Habilidades e ferramentas</label>
          <UiChipInput v-model="profile.keywords" placeholder="Ex: Google Ads, Excel, SQL" add-placeholder="Adicionar habilidade…" aria-label="Habilidades e ferramentas" />
          <p class="text-[12px] text-subtle mt-1.5">Quanto mais dessas aparecerem na descrição de uma vaga, maior o match.</p>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button class="btn-primary" :disabled="!profile.titles?.length" @click="useTitles">
            <Search class="w-4 h-4" /> Buscar vagas com estes cargos
          </button>
          <button class="btn-ghost" @click="clearProfile"><Trash2 class="w-4 h-4" /> Apagar currículo</button>
        </div>
      </section>

      <section v-else class="card p-8 text-center text-muted">
        <FileUser class="w-10 h-10 mx-auto mb-3 text-subtle" />
        <p class="font-semibold text-ink">Nenhum currículo ainda</p>
        <p class="text-[13px] mt-1 max-w-sm mx-auto">Envie o arquivo ao lado. Vamos identificar seu nível, os cargos ideais e suas principais habilidades — e você pode corrigir tudo depois.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { CloudUpload, LoaderCircle, CircleAlert, FileText, ChevronRight, WandSparkles, Search, Trash2, FileUser } from '@lucide/vue';

const emit = defineEmits(['go']);
const { profile, cvText, filters, runSearch, auth } = useJobFinder();
const { busy, busyLabel, error, fileName, upload, analyze } = useCvUpload();

const LEVELS = ['estágio', 'júnior', 'pleno', 'sênior'];
const dragging = ref(false);
const showText = ref(false);
// Se não deu para ler o arquivo, abre o campo para colar o texto
watch(error, (e) => { if (e) showText.value = true; });

const onPick = (e) => { upload(e.target.files?.[0]); e.target.value = ''; };
const onDrop = (e) => { dragging.value = false; upload(e.dataTransfer?.files?.[0]); };

function useTitles() {
  filters.value = { ...filters.value, queries: [...profile.value.titles] };
  emit('go', 'jobs');
  runSearch();
}

function clearProfile() {
  if (!confirm('Apagar o currículo e o perfil salvos neste computador?')) return;
  profile.value = null;
  cvText.value = '';
  fileName.value = '';
}
</script>
