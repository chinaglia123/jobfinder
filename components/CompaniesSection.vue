<template>
  <div class="px-4 lg:px-8 py-5 lg:py-7 max-w-5xl mx-auto space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Empresas e fontes</h1>
        <p class="text-muted mt-1 max-w-2xl">
          Além de LinkedIn e Gupy, o app lê direto o site de carreiras destas empresas a cada 6 horas. Muitas dessas vagas nunca chegam aos grandes portais.
        </p>
      </div>
      <button v-if="isAdmin" class="btn-secondary" :disabled="reindexing || status?.running" @click="reindex">
        <LoaderCircle v-if="reindexing || status?.running" class="w-4 h-4 animate-spin" /><RefreshCw v-else class="w-4 h-4" />
        {{ reindexing || status?.running ? 'Atualizando… (pode levar alguns minutos)' : 'Atualizar agora' }}
      </button>
    </header>

    <!-- Agente local -->
    <section class="card p-5" aria-label="Agente local">
      <div class="flex flex-wrap items-start gap-3">
        <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" :class="agent.online ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'">
          <Plug class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-[220px]">
          <h2 class="font-semibold flex items-center gap-2">
            Agente local
            <span :class="agent.online ? 'badge-ok' : 'badge-neutral'">{{ agent.online ? `Conectado · v${agent.version}` : agent.checked ? 'Desligado' : 'Verificando…' }}</span>
          </h2>
          <p class="text-[13px] text-muted mt-1">
            Um pequeno programa que roda no seu computador e busca no <b>Indeed</b> e no <b>Glassdoor</b>, sites que bloqueiam servidores na nuvem.
            Ele só conversa com esta tela; nada é enviado para outros lugares.
          </p>
        </div>
        <button class="btn-secondary btn-sm" @click="checkAgent"><RefreshCw class="w-4 h-4" /> Verificar</button>
      </div>
      <ol v-if="!agent.online" class="mt-4 space-y-2 text-[13px] list-decimal pl-5 marker:text-subtle">
        <li>Instale o <a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer" class="text-accent font-semibold">Python 3.10 ou mais novo</a> (no Windows, marque "Add python.exe to PATH").</li>
        <li><a :href="agentZip" class="text-accent font-semibold">Baixe o agente</a> e descompacte numa pasta (ou use a pasta <code class="px-1 rounded bg-surface-2">agente-local</code> do projeto).</li>
        <li>Dê dois cliques em <code class="px-1 rounded bg-surface-2">iniciar.bat</code> (Windows) ou rode <code class="px-1 rounded bg-surface-2">./iniciar.sh</code> (Mac/Linux). Deixe a janela aberta.</li>
        <li>Clique em <b>Verificar</b>. Pronto: as próximas buscas incluem Indeed e Glassdoor.</li>
      </ol>
    </section>

    <!-- Números -->
    <div v-if="status" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="s in stats" :key="s.label" class="card p-4">
        <div class="text-[12px] text-muted">{{ s.label }}</div>
        <div class="text-[22px] font-bold tabular-nums mt-0.5" :class="s.cls">{{ s.value }}</div>
        <div v-if="s.hint" class="text-[12px] text-subtle">{{ s.hint }}</div>
      </div>
    </div>

    <!-- Adicionar -->
    <section class="card p-5" aria-label="Adicionar empresa">
      <h2 class="font-semibold">Adicionar uma empresa</h2>
      <p class="text-[13px] text-muted mt-0.5">Abra o "Trabalhe conosco" da empresa. Se o link de uma vaga levar para Greenhouse, Lever ou Ashby, cole aqui.</p>
      <form class="mt-3 flex flex-col sm:flex-row gap-2" @submit.prevent="addCompany">
        <input v-model="newUrl" type="url" class="input" placeholder="https://jobs.lever.co/empresa" aria-label="Link da página de vagas" />
        <button type="submit" class="btn-primary h-10" :disabled="adding || !newUrl.trim()">
          <LoaderCircle v-if="adding" class="w-4 h-4 animate-spin" /><Plus v-else class="w-4 h-4" />
          {{ adding ? 'Conferindo…' : 'Adicionar' }}
        </button>
      </form>
      <p v-if="message" class="mt-2 text-[13px]" :class="messageError ? 'text-bad' : 'text-ok'">{{ message }}</p>
    </section>

    <!-- Lista -->
    <section class="card overflow-hidden" aria-label="Empresas acompanhadas">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-line">
        <h2 class="font-semibold flex-1">Empresas acompanhadas <span class="text-subtle font-normal tabular-nums">{{ companies.length }}</span></h2>
        <div class="relative w-full sm:w-56">
          <ListFilter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input v-model="filter" class="input h-9 pl-9 text-[13px]" placeholder="Filtrar empresas" aria-label="Filtrar empresas" />
        </div>
      </div>
      <ul class="divide-y divide-line max-h-[480px] overflow-y-auto scroll-thin">
        <li v-for="c in filtered" :key="c.id" class="flex items-center gap-3 px-4 py-2.5">
          <UiCompanyAvatar :name="c.name" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate" :class="!c.enabled && 'text-subtle line-through'">{{ c.name }}</div>
            <div class="text-[12px] text-subtle">
              {{ ATS_LABEL[c.ats] || c.ats }} ·
              <span v-if="c.error" class="text-bad" :title="c.error">erro na última leitura</span>
              <template v-else-if="c.last_indexed">{{ c.job_count }} vagas · {{ timeAgo(c.last_indexed) }}</template>
              <template v-else>aguardando leitura</template>
            </div>
          </div>
          <label v-if="isAdmin" class="switch" :title="c.enabled ? 'Desativar' : 'Ativar'">
            <input type="checkbox" :checked="!!c.enabled" :aria-label="`Acompanhar ${c.name}`" @change="toggle(c, $event.target.checked)" />
            <span></span>
          </label>
        </li>
      </ul>
    </section>

    <!-- Fontes ao vivo -->
    <section class="card p-5" aria-label="Fontes consultadas a cada busca">
      <h2 class="font-semibold">Consultadas a cada busca</h2>
      <ul class="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
        <li v-for="s in LIVE" :key="s.name" class="flex gap-2"><Check class="w-4 h-4 text-ok shrink-0 mt-0.5" /><span><b>{{ s.name }}</b> <span class="text-muted">— {{ s.desc }}</span></span></li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { RefreshCw, LoaderCircle, Plus, ListFilter, Check, Plug } from '@lucide/vue';

const { agent, checkAgent, auth } = useJobFinder();
const isAdmin = computed(() => auth.value.mode === 'local' || auth.value.user?.isAdmin);
const agentZip = '/api/agente/download';

const ATS_LABEL = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', feed: 'Agregador remoto' };
const LIVE = [
  { name: 'LinkedIn', desc: 'confirma a modalidade lendo a descrição' },
  { name: 'Gupy', desc: 'maior plataforma de vagas do Brasil' },
  { name: 'Himalayas', desc: 'remotas internacionais que aceitam o Brasil' },
  { name: 'Remotar', desc: 'remotas e híbridas brasileiras' },
  { name: 'Trampos', desc: 'comunicação, marketing e tecnologia' },
  { name: 'Get on Board', desc: 'América Latina' },
  { name: 'Remotive e Jobicy', desc: 'remotas internacionais' },
];

const companies = ref([]);
const status = ref(null);
const filter = ref('');
const newUrl = ref('');
const adding = ref(false);
const message = ref('');
const messageError = ref(false);
let timer = null;

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const stats = computed(() => [
  { label: 'Vagas indexadas', value: fmt(status.value.jobs) },
  { label: 'Remotas', value: fmt(status.value.remote), cls: 'text-ok', hint: `${fmt(status.value.hybrid)} híbridas` },
  { label: 'Empresas ativas', value: status.value.enabled, hint: status.value.errors ? `${status.value.errors} com erro` : status.value.lastIndexed ? `atualizado ${timeAgo(status.value.lastIndexed)}` : '' },
  { label: 'LinkedIn na fila', value: status.value.queue, hint: status.value.verifyBlockedUntil ? 'pausada pelo limite do LinkedIn' : 'confirmando em segundo plano' },
]);
const filtered = computed(() => {
  const t = filter.value.toLowerCase().trim();
  return t ? companies.value.filter((c) => c.name.toLowerCase().includes(t)) : companies.value;
});

const load = async () => {
  try { [companies.value, status.value] = await Promise.all([$fetch('/api/companies'), $fetch('/api/index/status')]); } catch {}
};
const reindexing = ref(false);
const reindex = async () => {
  reindexing.value = true;
  try {
    status.value = await $fetch('/api/index/run', { method: 'POST', body: { force: true } });
    await load();
  } catch (err) {
    message.value = err?.data?.message || err.message;
    messageError.value = true;
  } finally {
    reindexing.value = false;
  }
};

async function addCompany() {
  adding.value = true;
  message.value = '';
  try {
    const r = await $fetch('/api/companies', { method: 'POST', body: { url: newUrl.value } });
    message.value = `${r.name} adicionada com ${r.preview} vagas abertas.`;
    messageError.value = false;
    newUrl.value = '';
    setTimeout(load, 1500);
  } catch (err) {
    message.value = err?.data?.message || err.message;
    messageError.value = true;
  } finally {
    adding.value = false;
  }
}

async function toggle(c, enabled) {
  await $fetch(`/api/companies/${c.id}`, { method: 'PATCH', body: { enabled } });
  load();
}

onMounted(() => {
  load();
  checkAgent();
  timer = setInterval(() => { if (status.value?.running) load(); }, 4000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
