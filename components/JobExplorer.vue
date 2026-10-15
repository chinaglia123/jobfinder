<template>
  <div class="px-4 lg:px-8 py-5 lg:py-7 max-w-[1400px] mx-auto">
    <header class="mb-5">
      <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Encontre sua próxima vaga</h1>
      <p class="text-muted mt-1">
        Buscamos ao mesmo tempo no LinkedIn, Gupy, sites de carreira das empresas e agregadores remotos.
      </p>
    </header>

    <!-- Busca -->
    <form class="card p-4 lg:p-5" @submit.prevent="submit">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_auto] lg:items-end">
        <div>
          <label class="label" for="q">Cargos ou palavras-chave <span v-if="filters.areas?.length" class="font-normal text-subtle">(opcional com áreas escolhidas)</span></label>
          <UiChipInput
            id="q"
            v-model="filters.queries"
            placeholder="Ex: analista de marketing, social media"
            add-placeholder="Adicionar cargo…"
            aria-label="Cargos ou palavras-chave"
            @submit="submit"
          />
        </div>
        <div>
          <label class="label" for="city">Sua cidade <span class="font-normal text-subtle">(para híbrido)</span></label>
          <div class="relative">
            <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
            <input id="city" v-model="filters.location" class="input pl-9" placeholder="Ex: Sorocaba" />
          </div>
        </div>
        <button type="submit" class="btn-primary h-10 px-5" :disabled="!filters.queries.length && !filters.areas?.length">
          <Search class="w-4 h-4" />
          {{ dirty && search.ran ? 'Atualizar busca' : 'Buscar' }}
        </button>
      </div>

      <!-- Áreas: alternativa (ou complemento) aos cargos digitados -->
      <div class="mt-3">
        <button type="button" class="inline-flex items-center gap-2 h-8 text-[13px] font-semibold text-muted hover:text-ink" :aria-expanded="areasOpen" @click="areasOpen = !areasOpen">
          <LayoutGrid class="w-4 h-4" /> Escolher por área
          <span v-if="filters.areas?.length" class="badge-accent h-5">{{ filters.areas.length }}</span>
          <ChevronDown class="w-4 h-4 transition-transform" :class="areasOpen && 'rotate-180'" />
        </button>
        <div v-if="!areasOpen && filters.areas?.length" class="mt-1.5 flex flex-wrap gap-1.5">
          <span v-for="id in filters.areas" :key="id" class="chip bg-accent-soft border-accent/30 text-accent-ink">
            {{ areaLabel(id) }}
            <button type="button" class="grid place-items-center w-5 h-5 rounded-md hover:bg-accent/15" :aria-label="`Remover ${areaLabel(id)}`" @click="toggleArea(id)"><X class="w-3.5 h-3.5" /></button>
          </span>
        </div>
        <div v-if="areasOpen" class="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 animate-fade-up">
          <div v-for="g in AREA_GROUPS" :key="g.id" role="group" :aria-label="g.label">
            <div class="text-[12px] font-semibold text-subtle mb-1.5">{{ g.label }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="a in g.areas" :key="a.id" type="button"
                class="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[13px] font-medium transition-colors"
                :class="hasArea(a.id) ? 'bg-accent-soft border-accent/40 text-accent-ink' : 'border-line text-muted hover:text-ink hover:bg-surface-2'"
                :aria-pressed="hasArea(a.id)"
                :title="a.queries.join(', ')"
                @click="toggleArea(a.id)"
              >
                <Check v-if="hasArea(a.id)" class="w-3.5 h-3.5" />{{ a.label }}
              </button>
            </div>
          </div>
          <p class="sm:col-span-2 xl:col-span-3 text-[12px] text-subtle">
            Cada área busca vários cargos de uma vez (passe o mouse para ver quais). Dá para combinar áreas com cargos digitados.
          </p>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div class="segmented" role="group" aria-label="Modalidade">
          <button v-for="o in MODES" :key="o.v" type="button" :aria-pressed="filters.workMode === o.v" @click="filters.workMode = o.v">{{ o.l }}</button>
        </div>
        <button type="button" class="btn-ghost btn-sm lg:hidden" @click="moreOpen = !moreOpen">
          <SlidersHorizontal class="w-4 h-4" /> Mais filtros <ChevronDown class="w-4 h-4 transition-transform" :class="moreOpen && 'rotate-180'" />
        </button>
        <div class="w-full lg:w-auto lg:flex flex-wrap items-center gap-3" :class="moreOpen ? 'grid grid-cols-2' : 'hidden'">
          <select v-model="filters.seniority" class="select h-9 text-[13px] lg:w-auto" aria-label="Nível">
            <option value="">Todos os níveis</option>
            <option value="mid">Até pleno</option>
            <option value="junior">Júnior, assistente, estágio</option>
          </select>
          <select v-model.number="filters.days" class="select h-9 text-[13px] lg:w-auto" aria-label="Publicada em">
            <option v-for="d in [1, 3, 7, 14, 30, 60]" :key="d" :value="d">{{ d === 1 ? 'Últimas 24h' : `Últimos ${d} dias` }}</option>
          </select>
          <select v-model="filters.region" class="select h-9 text-[13px] lg:w-auto" aria-label="Região">
            <option value="br">Brasil</option>
            <option value="world">Exterior (inglês)</option>
          </select>
          <label class="flex items-center gap-2 text-[13px] text-muted cursor-pointer col-span-2">
            <span class="switch"><input v-model="filters.fewApplicants" type="checkbox" /><span></span></span>
            Poucas candidaturas
          </label>
          <label class="flex items-center gap-2 text-[13px] text-muted cursor-pointer col-span-2" title="Vagas em que não deu para confirmar se são remotas aparecem no fim da lista">
            <span class="switch"><input v-model="filters.includeUnconfirmed" type="checkbox" /><span></span></span>
            Incluir modalidade a confirmar
          </label>
          <label class="flex items-center gap-2 text-[13px] text-muted cursor-pointer col-span-2" title="Esconde vagas escritas em inglês ou espanhol">
            <span class="switch"><input :checked="filters.lang === 'pt'" type="checkbox" @change="filters.lang = $event.target.checked ? 'pt' : 'any'" /><span></span></span>
            Só vagas em português
          </label>
          <label class="flex items-center gap-2 text-[13px] text-muted cursor-pointer col-span-2" title="Some com vagas que pedem pagamento, prometem ganho fácil ou têm outros sinais fortes de golpe">
            <span class="switch"><input :checked="filters.hideSuspicious !== false" type="checkbox" @change="filters.hideSuspicious = $event.target.checked" /><span></span></span>
            Esconder vagas suspeitas
          </label>
          <label class="flex items-center gap-2 text-[13px] text-muted cursor-pointer col-span-2" :title="relatedHint">
            <span class="switch"><input v-model="filters.expand" type="checkbox" /><span></span></span>
            Incluir cargos relacionados
          </label>
        </div>
      </div>

      <div class="mt-3" :class="moreOpen ? 'block' : 'hidden lg:block'">
        <label class="label" for="excl">Excluir vagas com estas palavras no título <span class="font-normal text-subtle">(opcional)</span></label>
        <UiChipInput
          id="excl"
          v-model="filters.excludeTerms"
          placeholder="Ex: estágio, vendas, sênior, call center"
          add-placeholder="Adicionar palavra…"
          aria-label="Palavras para excluir"
        />
      </div>
    </form>

    <!-- Aviso de perfil -->
    <button
      v-if="!profile"
      class="mt-4 w-full flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/40 text-left hover:bg-accent-soft/70 transition-colors"
      @click="$emit('go', 'profile')"
    >
      <FileUser class="w-5 h-5 text-accent shrink-0" />
      <span class="flex-1 text-[14px]"><b>Envie seu currículo</b> para ver o quanto cada vaga combina com você e receber cargos sugeridos.</span>
      <ChevronRight class="w-4 h-4 text-accent" />
    </button>

    <!-- Barra de resultados -->
    <div v-if="search.ran" class="mt-6 flex flex-wrap items-center gap-3">
      <div class="segmented max-w-full overflow-x-auto scroll-thin" role="group" aria-label="Mostrar">
        <button v-for="t in viewTabs" :key="t.v" type="button" :aria-pressed="view === t.v" @click="view = t.v">
          {{ t.l }} <span class="ml-1 tabular-nums text-subtle font-medium">{{ t.n }}</span>
        </button>
      </div>
      <div class="relative flex-1 min-w-[180px] max-w-xs">
        <ListFilter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
        <input v-model="textFilter" class="input h-9 pl-9 text-[13px]" placeholder="Filtrar por empresa, cargo…" aria-label="Filtrar resultados" />
      </div>
      <div v-if="contractOptions.length" class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de contrato">
        <button
          v-for="c in contractOptions" :key="c.v" type="button"
          class="h-8 px-2.5 rounded-lg border text-[12px] font-semibold transition-colors"
          :class="contracts.includes(c.v) ? 'bg-accent-soft border-accent/40 text-accent-ink' : 'border-line text-muted hover:text-ink'"
          :aria-pressed="contracts.includes(c.v)"
          @click="toggleContract(c.v)"
        >{{ c.l }} <span class="tabular-nums font-medium text-subtle">{{ c.n }}</span></button>
      </div>
      <select v-model="sortBy" class="select h-9 text-[13px] w-auto ml-auto" aria-label="Ordenar">
        <option value="match">{{ profile ? 'Melhor match' : 'Mais relevantes' }}</option>
        <option value="recent">Mais recentes</option>
      </select>
      <button type="button" class="btn-ghost btn-sm" :aria-expanded="sourcesOpen" @click="sourcesOpen = !sourcesOpen">
        <Globe class="w-4 h-4" /> {{ okSources }} fontes <ChevronDown class="w-4 h-4 transition-transform" :class="sourcesOpen && 'rotate-180'" />
      </button>
    </div>

    <!-- Fontes consultadas -->
    <div v-if="sourcesOpen && search.ran" class="mt-3 card p-4 space-y-3 animate-fade-up">
      <div class="flex flex-wrap gap-1.5">
        <span v-for="(st, id) in search.status" :key="id" :class="st.ok ? 'badge-neutral' : 'badge-bad'" :title="st.error || ''">
          <Check v-if="st.ok" class="w-3.5 h-3.5 text-ok" /><X v-else class="w-3.5 h-3.5" />
          {{ labels[id] || id }} <span class="tabular-nums font-medium">{{ st.raw ?? '' }}</span>
        </span>
      </div>
      <p v-if="search.status.empresas?.indexadas" class="text-[13px] text-muted">
        Sites das empresas: {{ search.status.empresas.raw }} vagas com seus termos, entre {{ fmt(search.status.empresas.indexadas) }} indexadas de {{ search.status.empresas.quadros }} empresas.
      </p>
      <p v-if="search.status.linkedin?.verificadas !== undefined" class="text-[13px] text-muted">
        LinkedIn: {{ search.status.linkedin.verificadas }} vagas tiveram a modalidade confirmada lendo a descrição<template v-if="search.status.linkedin.pendentes">; {{ search.status.linkedin.pendentes }} seguem em segundo plano e aparecem confirmadas na próxima busca</template>.
      </p>
      <p v-if="search.status.confianca?.escondidas" class="text-[13px] text-muted">
        {{ search.status.confianca.escondidas }} {{ search.status.confianca.escondidas === 1 ? 'vaga com sinais fortes de golpe foi escondida' : 'vagas com sinais fortes de golpe foram escondidas' }} (dá para mostrar em "Mais filtros").
      </p>
      <div v-if="search.links?.length">
        <div class="text-[12px] font-semibold text-muted mb-1.5">Também vale procurar em (sites que bloqueiam robôs):</div>
        <div class="flex flex-wrap gap-1.5">
          <a v-for="l in search.links" :key="l.name" :href="l.url" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm">
            {{ l.name }} <ExternalLink class="w-3.5 h-3.5 text-subtle" />
          </a>
        </div>
      </div>
    </div>

    <!-- Progresso do LinkedIn -->
    <div v-if="pending && search.jobs.length" class="mt-3 flex items-center gap-3 text-[13px] text-muted">
      <div class="relative h-1 w-24 rounded-full bg-line overflow-hidden"><div class="absolute inset-y-0 w-1/3 rounded-full bg-accent animate-progress"></div></div>
      Ainda consultando {{ pending }} — as vagas entram na lista sozinhas.
    </div>
    <button
      v-else-if="search.ran && agent.checked && !agent.online && !agentTipClosed"
      class="mt-3 w-full flex items-center gap-2 text-left text-[13px] text-muted hover:text-ink"
      @click="$emit('go', 'sources')"
    >
      <Plug class="w-4 h-4 text-accent shrink-0" />
      <span class="flex-1">Quer vagas do <b>Indeed</b> e do <b>Glassdoor</b> também? Ative o agente local no seu computador.</span>
      <span class="text-subtle hover:text-ink" role="button" aria-label="Dispensar" @click.stop="closeAgentTip"><X class="w-4 h-4" /></span>
    </button>

    <!-- Resultados -->
    <div class="mt-4 xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-5">
      <section aria-label="Lista de vagas">
        <!-- Carregando -->
        <div v-if="search.loadingFast && !search.jobs.length" class="space-y-2.5">
          <div class="flex items-center gap-2 text-[13px] text-muted mb-1"><LoaderCircle class="w-4 h-4 animate-spin" /> Procurando em todas as fontes…</div>
          <div v-for="i in 5" :key="i" class="flex gap-3 p-3.5 rounded-2xl border border-line bg-surface">
            <div class="w-10 h-10 rounded-xl bg-surface-2 animate-pulse"></div>
            <div class="flex-1 space-y-2"><div class="h-4 w-3/4 rounded bg-surface-2 animate-pulse"></div><div class="h-3 w-1/2 rounded bg-surface-2 animate-pulse"></div><div class="h-5 w-1/3 rounded bg-surface-2 animate-pulse"></div></div>
          </div>
        </div>

        <!-- Erro -->
        <div v-else-if="search.error && !search.jobs.length" class="card p-8 text-center">
          <CircleAlert class="w-8 h-8 text-bad mx-auto mb-2" />
          <p class="font-semibold">Não foi possível buscar agora</p>
          <p class="text-muted text-[13px] mt-1">{{ search.error }}</p>
          <button class="btn-secondary mt-4" @click="submit">Tentar de novo</button>
        </div>

        <!-- Vazio -->
        <div v-else-if="search.ran && !search.loadingFast && !search.loadingSlow && !search.loadingAgent && !visible.length" class="card p-8 text-center">
          <SearchX class="w-8 h-8 text-subtle mx-auto mb-2" />
          <p class="font-semibold">Nenhuma vaga com esses filtros</p>
          <p class="text-muted text-[13px] mt-1 max-w-sm mx-auto">Tente aumentar o período, incluir "a confirmar", trocar a modalidade ou usar cargos mais amplos.</p>
          <div class="flex flex-wrap justify-center gap-2 mt-4">
            <button v-if="filters.days < 60" class="btn-secondary btn-sm" @click="runSearch({ days: 60 })">Últimos 60 dias</button>
            <button v-if="filters.workMode !== 'any'" class="btn-secondary btn-sm" @click="runSearch({ workMode: 'any' })">Qualquer modalidade</button>
          </div>
        </div>

        <div v-else class="space-y-2.5">
          <JobListItem
            v-for="job in shown" :key="job.url"
            :job="job"
            :selected="job.url === selectedUrl"
            :saved="savedByUrl.has(job.url)"
            @select="open(job)"
            @save="toggleSave(job)"
            @hide="hideJob(job)"
          />
          <button v-if="shown.length < visible.length" class="btn-secondary w-full" @click="limit += 40">
            Mostrar mais {{ Math.min(40, visible.length - shown.length) }} de {{ visible.length - shown.length }}
          </button>
        </div>
      </section>

      <!-- Detalhes (tela larga) -->
      <aside class="hidden xl:block">
        <div class="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto scroll-thin card">
          <JobDetail v-if="selectedJob" :job="selectedJob" @go="$emit('go', $event)" @hide="hideJob(selectedJob)" />
          <div v-else class="p-10 text-center text-muted">
            <MousePointerClick class="w-8 h-8 mx-auto mb-2 text-subtle" />
            Selecione uma vaga para ver a descrição, o match com seu currículo e gerar uma mensagem para o recrutador.
          </div>
        </div>
      </aside>
    </div>

    <!-- Detalhes em telas menores: tela cheia no celular, painel lateral no notebook -->
    <Teleport to="body">
      <div v-if="mobileOpen && selectedJob" class="xl:hidden fixed inset-0 z-50">
        <div class="hidden lg:block absolute inset-0 bg-black/30" @click="mobileOpen = false"></div>
        <div class="absolute inset-0 lg:left-auto lg:w-[600px] bg-surface lg:border-l lg:border-line lg:shadow-pop overflow-y-auto animate-fade-up" role="dialog" aria-modal="true" :aria-label="selectedJob.title">
          <div class="sticky top-0 z-10 flex items-center h-14 px-2 bg-surface/95 backdrop-blur border-b border-line">
            <button class="btn-ghost" @click="mobileOpen = false"><ChevronLeft class="w-5 h-5" /> Voltar às vagas</button>
          </div>
          <JobDetail :job="selectedJob" @go="mobileOpen = false; $emit('go', $event)" @hide="mobileOpen = false; hideJob(selectedJob)" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import {
  Search, MapPin, SlidersHorizontal, ChevronDown, ChevronRight, ChevronLeft, FileUser, ListFilter, Globe,
  Check, X, ExternalLink, LoaderCircle, CircleAlert, SearchX, MousePointerClick, Plug, LayoutGrid,
} from '@lucide/vue';
import { AREA_GROUPS, areaLabel } from '#shared/areas.js';

defineEmits(['go']);

const { filters, profile, search, agent, selectedUrl, selectedJob, savedByUrl, runSearch, saveJob, removeSaved, toast, hideJob } = useJobFinder();

// O que ainda está carregando (para a barra de progresso)
const pending = computed(() => {
  const p = [];
  if (search.value.loadingSlow) p.push('o LinkedIn');
  if (search.value.loadingAgent && agent.value.online) p.push('Indeed e Glassdoor (agente local)');
  return p.join(' e ');
});
const agentTipClosed = ref(false);
const closeAgentTip = () => {
  agentTipClosed.value = true;
  try { localStorage.setItem('jf_agent_tip', '1'); } catch {}
};
onMounted(() => { try { agentTipClosed.value = !!localStorage.getItem('jf_agent_tip'); } catch {} });

const MODES = [
  { v: 'remote', l: 'Só remoto' },
  { v: 'remote_hybrid', l: 'Remoto + híbrido' },
  { v: 'any', l: 'Qualquer' },
];

const moreOpen = ref(false);

// Seletor de áreas: começa aberto se a pessoa ainda não escolheu nada
const areasOpen = ref(!filters.value.queries?.length && !filters.value.areas?.length);
const hasArea = (id) => (filters.value.areas || []).includes(id);
const toggleArea = (id) => {
  const cur = filters.value.areas || [];
  filters.value = { ...filters.value, areas: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
};
const sourcesOpen = ref(false);
const mobileOpen = ref(false);
const view = ref('all');
const sortBy = ref('match');
const textFilter = ref('');
const limit = ref(40);
const labels = SOURCE_LABELS;
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

// Filtros mudaram desde a última busca?
const lastRun = ref('');
const snapshot = () => JSON.stringify(filters.value);
const dirty = computed(() => lastRun.value && snapshot() !== lastRun.value);
watch(() => search.value.startedAt, () => { lastRun.value = snapshot(); }, { immediate: true });

const submit = () => {
  limit.value = 40;
  runSearch();
};

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const byText = computed(() => {
  const t = norm(textFilter.value).trim();
  return t ? search.value.jobs.filter((j) => norm(`${j.title} ${j.company} ${j.location}`).includes(t)) : search.value.jobs;
});
const count = (m) => byText.value.filter((j) => j.mode === m).length;
const viewTabs = computed(() => [
  { v: 'all', l: 'Todas', n: byText.value.length },
  { v: 'remote', l: 'Remotas', n: count('remote') },
  { v: 'hybrid', l: 'Híbridas', n: count('hybrid') },
  ...(count('unknown') ? [{ v: 'unknown', l: 'A confirmar', n: count('unknown') }] : []),
]);
// Tipo de contrato (filtro rápido, sem nova busca)
const CONTRACTS = [
  { v: 'clt', l: 'CLT' }, { v: 'pj', l: 'PJ' }, { v: 'estagio', l: 'Estágio' },
  { v: 'freela', l: 'Freela' }, { v: 'temporario', l: 'Temporária' },
];
const contracts = ref([]);
const toggleContract = (v) => {
  contracts.value = contracts.value.includes(v) ? contracts.value.filter((x) => x !== v) : [...contracts.value, v];
};
const contractOptions = computed(() => CONTRACTS
  .map((c) => ({ ...c, n: byText.value.filter((j) => (j.contract || []).includes(c.v)).length }))
  .filter((c) => c.n || contracts.value.includes(c.v)));
const byContract = computed(() => (contracts.value.length
  ? byText.value.filter((j) => contracts.value.some((c) => (j.contract || []).includes(c)))
  : byText.value));
const relatedHint = 'Ex: buscando "marketing", também procura social media, growth, tráfego pago, CRM, SEO, conteúdo...';

const visible = computed(() => {
  const list = view.value === 'all' ? byContract.value : byContract.value.filter((j) => j.mode === view.value);
  return sortBy.value === 'match' ? list : sortJobs(list, 'recent');
});
const shown = computed(() => visible.value.slice(0, limit.value));
const okSources = computed(() => Object.values(search.value.status).filter((s) => s.ok).length);

const open = (job) => {
  selectedUrl.value = job.url;
  if (window.matchMedia('(max-width: 1279px)').matches) mobileOpen.value = true;
};

// Esc fecha o painel de detalhes
const onKey = (e) => { if (e.key === 'Escape') mobileOpen.value = false; };
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const toggleSave = async (job) => {
  const saved = savedByUrl.value.get(job.url);
  if (saved) {
    await removeSaved(saved.application_id);
    toast('Removida das candidaturas');
  } else if (await saveJob(job)) {
    toast('Salva nas candidaturas');
  }
};
</script>
