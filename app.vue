<template>
  <div v-if="!auth.loaded" class="min-h-screen grid place-items-center text-subtle"><LoaderCircle class="w-6 h-6 animate-spin" /></div>
  <LoginScreen v-else-if="auth.mode === 'hosted' && !auth.user" />
  <div v-else class="min-h-screen lg:flex">
    <!-- Menu lateral (computador) -->
    <aside class="hidden lg:flex lg:flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-line bg-surface px-3 py-4">
      <div class="flex items-center gap-2.5 px-2 mb-6">
        <div class="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center dark:text-bg">
          <Radar class="w-5 h-5" />
        </div>
        <div class="leading-tight">
          <div class="font-bold text-[15px]">JobFinder</div>
          <div class="text-[12px] text-subtle">vagas que ninguém achou</div>
        </div>
      </div>

      <nav class="flex flex-col gap-0.5" aria-label="Seções">
        <button
          v-for="t in tabs" :key="t.id"
          class="flex items-center gap-3 h-10 px-3 rounded-xl text-[14px] font-medium transition-colors text-left"
          :class="tab === t.id ? 'bg-accent-soft text-accent-ink font-semibold' : 'text-muted hover:text-ink hover:bg-surface-2'"
          :aria-current="tab === t.id ? 'page' : undefined"
          @click="tab = t.id"
        >
          <component :is="t.icon" class="w-[18px] h-[18px]" />
          <span class="flex-1">{{ t.label }}</span>
          <span v-if="t.count" class="text-[12px] font-semibold tabular-nums text-subtle">{{ t.count }}</span>
        </button>
      </nav>

      <div class="mt-auto space-y-3">
        <button class="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-[14px] font-semibold bg-surface-2 hover:bg-line/60 transition-colors" @click="chatOpen = true">
          <Sparkles class="w-[18px] h-[18px] text-accent" />
          Copiloto IA
        </button>
        <div v-if="auth.mode === 'hosted' && auth.user" class="flex items-center gap-2 px-2">
          <UiCompanyAvatar :name="auth.user.name || auth.user.email" size="sm" />
          <div class="min-w-0 flex-1 text-[12px] leading-tight">
            <div class="font-semibold truncate">{{ auth.user.name || 'Minha conta' }}</div>
            <div class="text-subtle truncate">{{ auth.user.email }}</div>
          </div>
          <button class="btn-icon btn-ghost" aria-label="Sair" title="Sair" @click="logout"><LogOut class="w-4 h-4" /></button>
        </div>
        <div class="flex items-center justify-between px-2">
          <button class="flex items-center gap-1.5 text-[12px] text-subtle hover:text-ink" :title="aiKey?.key ? 'Usando a sua chave de IA' : info?.ai ? `Modelo: ${info.model}` : 'Configure uma chave de IA em Ajustes'" @click="tab = 'settings'">
            <span class="w-1.5 h-1.5 rounded-full" :class="aiKey?.key || info?.ai ? 'bg-ok' : 'bg-warn'"></span>
            {{ aiKey?.key ? `IA: sua chave (${aiKey.provider})` : info?.ai ? `IA: ${info.provider}` : 'IA local (sem chave)' }}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>

    <!-- Topo (celular) -->
    <header class="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-surface/90 backdrop-blur border-b border-line">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-accent text-white grid place-items-center dark:text-bg"><Radar class="w-[18px] h-[18px]" /></div>
        <span class="font-bold">JobFinder</span>
      </div>
      <div class="flex items-center gap-1">
        <ThemeToggle />
        <button class="btn-icon btn-ghost" aria-label="Abrir Copiloto IA" @click="chatOpen = true"><Sparkles class="w-5 h-5 text-accent" /></button>
      </div>
    </header>

    <main class="flex-1 min-w-0 pb-20 lg:pb-0">
      <Onboarding v-if="onboarding && tab === 'jobs'" @done="onboarding = false" />
      <JobExplorer v-else-if="tab === 'jobs'" @go="tab = $event" />
      <KanbanBoard v-else-if="tab === 'applications'" @go="tab = $event" />
      <ResumeSection v-else-if="tab === 'profile'" @go="tab = $event" />
      <CompaniesSection v-else-if="tab === 'sources'" />
      <SettingsSection v-else-if="tab === 'settings'" />
    </main>

    <!-- Barra inferior (celular) -->
    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="Seções">
      <button
        v-for="t in tabs" :key="t.id"
        class="relative flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium"
        :class="tab === t.id ? 'text-accent' : 'text-subtle'"
        :aria-current="tab === t.id ? 'page' : undefined"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="w-5 h-5" />
        {{ t.short }}
        <span v-if="t.count" class="absolute top-2 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-full bg-accent text-white dark:text-bg text-[10px] leading-4 font-bold">{{ t.count }}</span>
      </button>
    </nav>

    <AIChatDrawer :open="chatOpen" @close="chatOpen = false" @go="tab = $event" />

    <!-- Avisos -->
    <div class="fixed z-[60] bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
      <div
        v-for="t in toasts" :key="t.id"
        class="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-pop text-[13px] font-semibold animate-fade-up bg-ink text-bg"
      >
        <CircleCheck v-if="t.kind === 'ok'" class="w-4 h-4 text-ok" />
        <CircleAlert v-else class="w-4 h-4 text-bad" />
        {{ t.message }}
        <button v-if="t.action" class="ml-2 underline underline-offset-2 hover:no-underline" @click="t.action.run(); toasts = toasts.filter((x) => x.id !== t.id)">{{ t.action.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Radar, Search, KanbanSquare, FileUser, Building2, Settings, Sparkles, CircleCheck, CircleAlert, LoaderCircle, LogOut } from '@lucide/vue';

const { filters, profile, cvText, kanban, toasts, info, auth, aiKey, fetchInfo, fetchKanban, runSearch, fetchMe, logout, loadUserData, saveUserData, loadAiKey } = useJobFinder();

const tab = ref('jobs');
const chatOpen = ref(false);
// Primeiro acesso: conta nova, sem currículo nem filtros salvos
const onboarding = ref(false);

const savedCount = computed(() => Object.values(kanban.value).reduce((n, col) => n + (col?.length || 0), 0));
const tabs = computed(() => [
  { id: 'jobs', label: 'Vagas', short: 'Vagas', icon: Search },
  { id: 'applications', label: 'Candidaturas', short: 'Funil', icon: KanbanSquare, count: savedCount.value || null },
  { id: 'profile', label: 'Meu currículo', short: 'Currículo', icon: FileUser },
  { id: 'sources', label: 'Empresas e fontes', short: 'Empresas', icon: Building2 },
  { id: 'settings', label: 'Ajustes', short: 'Ajustes', icon: Settings },
]);

// Dados antigos guardados só no navegador (versões anteriores, modo local)
const load = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

let stopWatchers = [];
/** Carrega os dados da pessoa (do servidor) e faz a primeira busca. Roda após o login no modo hospedado. */
async function start() {
  stopWatchers.forEach((stop) => stop());
  const server = await loadUserData();
  // Migra o que estava só no navegador para o servidor (uma vez, modo local)
  if (auth.value.mode === 'local' && server && !server.profile && !server.cvText) {
    const legacy = { filters: load('jf_filters', null), profile: load('jf_analysis', null), cvText: load('jf_cv_text', null) ?? (localStorage.getItem('jf_cv') || '') };
    if (legacy.filters) filters.value = { ...filters.value, ...legacy.filters };
    if (legacy.profile) profile.value = legacy.profile;
    if (legacy.cvText) cvText.value = legacy.cvText;
    if (legacy.profile || legacy.cvText) saveUserData({ filters: filters.value, profile: profile.value, cvText: cvText.value });
  }
  stopWatchers = [
    watch(filters, (v) => saveUserData({ filters: v }), { deep: true }),
    watch(profile, (v) => saveUserData({ profile: v }), { deep: true }),
    watch(cvText, (v) => saveUserData({ cvText: v })),
  ];
  fetchInfo();
  fetchKanban();
  onboarding.value = !!server && !server.profile && !server.cvText && !server.filters;
  const f = filters.value;
  if (!onboarding.value && (f.queries?.length || f.areas?.length || f.explore)) runSearch();
}

onMounted(async () => {
  loadAiKey();
  const me = await fetchMe();
  if (me.mode === 'hosted' && !me.user) fetchInfo();
});

// Carrega os dados assim que há alguém na conta: ao abrir o app já logado e logo depois do login.
// (A tela de login some antes de conseguir avisar, por isso o app observa a conta em vez de esperar um evento.)
watch(() => auth.value.loaded && (auth.value.mode === 'local' ? 'local' : auth.value.user?.id || null), (who, before) => {
  if (who && who !== before) start();
});

// Ao sair da conta, volta para a tela de login
watch(() => auth.value.user, (u, old) => { if (old && !u) tab.value = 'jobs'; });
</script>
