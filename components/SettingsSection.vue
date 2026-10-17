<template>
  <div class="px-4 lg:px-8 py-5 lg:py-7 max-w-3xl mx-auto space-y-5">
    <header>
      <h1 class="text-[22px] lg:text-[26px] font-bold tracking-tight">Ajustes</h1>
      <p v-if="info?.ai && auth.mode === 'hosted'" class="text-muted mt-1">A IA do site já está ativa para você: até <b>{{ info.aiPerDay }} usos por dia</b> (análise do currículo, currículo sob medida, triagem e Copiloto). Uma chave própria é opcional e tira esse limite.</p>
      <p v-else class="text-muted mt-1">Sem IA o app funciona com uma análise local mais simples. Com uma chave gratuita, a leitura do currículo, o match e as mensagens ficam bem melhores.</p>
    </header>

    <!-- Chave de IA da própria pessoa -->
    <section class="card p-5 space-y-4" aria-label="Sua chave de IA">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl grid place-items-center shrink-0" :class="aiKey?.key ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'">
          <KeyRound class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold flex flex-wrap items-center gap-2">
            Sua chave de IA
            <span v-if="aiKey?.key" class="badge-ok">Em uso · {{ PROVIDER_INFO[aiKey.provider]?.name }}</span>
            <span v-else class="badge-neutral">{{ info?.ai ? 'Opcional' : 'Não configurada' }}</span>
          </h2>
          <p class="text-[13px] text-muted mt-1">
            Use a sua própria chave gratuita para a análise do currículo, o match detalhado, as mensagens e o Copiloto.
            Ela fica salva <b>só neste navegador</b> e é enviada apenas nas chamadas de IA — o servidor não guarda.
          </p>
        </div>
      </div>

      <div v-if="aiKey?.key && !editing" class="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-surface-2/60 text-[13px]">
        <span class="flex-1 min-w-0 truncate">
          <b>{{ PROVIDER_INFO[aiKey.provider]?.name }}</b> · chave terminando em <code class="font-mono">…{{ aiKey.key.slice(-4) }}</code>
          <template v-if="aiKey.model"> · modelo {{ aiKey.model }}</template>
        </span>
        <button class="btn-secondary btn-sm" @click="startEdit">Trocar</button>
        <button class="btn-ghost btn-sm text-bad" @click="removeKey"><Trash2 class="w-4 h-4" /> Remover</button>
      </div>

      <form v-else class="space-y-3" @submit.prevent="testAndSave">
        <div>
          <span class="label">Provedor</span>
          <div class="segmented" role="group" aria-label="Provedor de IA">
            <button v-for="(p, id) in PROVIDER_INFO" :key="id" type="button" :aria-pressed="form.provider === id" @click="form.provider = id">{{ p.name }}</button>
          </div>
          <p class="text-[12px] text-muted mt-1.5">
            {{ PROVIDER_INFO[form.provider].desc }}
            <a :href="PROVIDER_INFO[form.provider].url" target="_blank" rel="noopener noreferrer" class="text-accent font-semibold inline-flex items-center gap-0.5">Criar chave grátis <ExternalLink class="w-3 h-3" /></a>
          </p>
        </div>
        <div>
          <label class="label" for="aikey">Chave</label>
          <div class="relative">
            <input id="aikey" v-model.trim="form.key" :type="showKey ? 'text' : 'password'" class="input pr-10 font-mono text-[13px]" :placeholder="PROVIDER_INFO[form.provider].placeholder" autocomplete="off" spellcheck="false" required />
            <button type="button" class="absolute right-1 top-1/2 -translate-y-1/2 btn-icon btn-ghost h-8 w-8" :aria-label="showKey ? 'Esconder chave' : 'Mostrar chave'" @click="showKey = !showKey">
              <EyeOff v-if="showKey" class="w-4 h-4" /><Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
        <details class="group">
          <summary class="flex items-center gap-1.5 text-[13px] font-semibold text-muted cursor-pointer list-none hover:text-ink">
            <ChevronRight class="w-4 h-4 transition-transform group-open:rotate-90" /> Modelo (opcional)
          </summary>
          <input v-model.trim="form.model" class="input mt-2 text-[13px]" :placeholder="`Padrão: ${PROVIDER_INFO[form.provider].model}`" aria-label="Modelo" />
        </details>
        <p v-if="keyMsg" class="flex gap-2 text-[13px]" :class="keyOk ? 'text-ok' : 'text-bad'">
          <CircleCheck v-if="keyOk" class="w-4 h-4 shrink-0 mt-0.5" /><CircleAlert v-else class="w-4 h-4 shrink-0 mt-0.5" />{{ keyMsg }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn-primary" :disabled="testing || !form.key">
            <LoaderCircle v-if="testing" class="w-4 h-4 animate-spin" /><PlugZap v-else class="w-4 h-4" />
            {{ testing ? 'Testando…' : 'Testar e salvar' }}
          </button>
          <button v-if="aiKey?.key" type="button" class="btn-ghost" @click="editing = false">Cancelar</button>
        </div>
        <p class="text-[12px] text-subtle">Em computador compartilhado, remova a chave ao terminar.</p>
      </form>
    </section>

    <!-- IA do servidor -->
    <section class="card p-5" aria-label="IA do servidor">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl grid place-items-center" :class="info?.ai ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'">
          <Bot class="w-5 h-5" />
        </div>
        <div>
          <div class="font-semibold">{{ info?.ai ? `IA do ${auth.mode === 'hosted' ? 'site' : 'app'}: ${info.provider}` : `IA do ${auth.mode === 'hosted' ? 'site' : 'app'} desligada` }}</div>
          <div class="text-[13px] text-muted">
            <template v-if="info?.ai && aiKey?.key">Usada só se a sua chave falhar.</template>
            <template v-else-if="info?.ai">{{ info.model }}{{ auth.mode === 'hosted' ? ' · com limite de uso por pessoa' : '' }}</template>
            <template v-else>Sem chave nenhuma, o app usa a análise local (mais simples).</template>
          </div>
        </div>
      </div>
      <details v-if="isAdmin && auth.mode === 'local'" class="group mt-4">
        <summary class="flex items-center gap-1.5 text-[13px] font-semibold text-muted cursor-pointer list-none hover:text-ink">
          <ChevronRight class="w-4 h-4 transition-transform group-open:rotate-90" /> Configurar a chave no arquivo .env (alternativa)
        </summary>
        <pre class="mt-2 p-3.5 rounded-xl bg-surface-2 border border-line text-[12px] font-mono overflow-x-auto">GROQ_API_KEY=sua_chave_aqui
# ou
GEMINI_API_KEY=sua_chave_aqui</pre>
      </details>
      <p v-else-if="isAdmin" class="mt-3 text-[13px] text-muted">Para definir a chave do site, configure <code class="px-1 rounded bg-surface-2">GROQ_API_KEY</code> ou <code class="px-1 rounded bg-surface-2">GEMINI_API_KEY</code> nas variáveis de ambiente da hospedagem.</p>
    </section>

    <section class="card p-5" aria-label="Vagas ocultas">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">Vagas ocultas <span class="text-subtle font-normal tabular-nums">{{ hidden.length }}</span></h2>
      </div>
      <p class="text-[13px] text-muted mt-0.5">Vagas em que você clicou em "Não tenho interesse". Elas não aparecem mais nas buscas.</p>
      <ul v-if="hidden.length" class="mt-3 divide-y divide-line max-h-80 overflow-y-auto scroll-thin">
        <li v-for="h in hidden" :key="h.url" class="flex items-center gap-3 py-2.5">
          <UiCompanyAvatar :name="h.company" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate">{{ h.title }}</div>
            <div class="text-[12px] text-subtle truncate">{{ h.company }}</div>
          </div>
          <button class="btn-ghost btn-sm" @click="restore(h)"><Eye class="w-4 h-4" /> Mostrar de novo</button>
        </li>
      </ul>
      <p v-else class="mt-3 text-[13px] text-subtle">Nenhuma vaga oculta.</p>
    </section>
  </div>
</template>

<script setup>
import { Bot, ExternalLink, Eye, EyeOff, KeyRound, Trash2, ChevronRight, CircleCheck, CircleAlert, LoaderCircle, PlugZap } from '@lucide/vue';

const { info, auth, unhideJob, toast, aiKey, setAiKey, aiHeaders } = useJobFinder();

const PROVIDER_INFO = {
  groq: { name: 'Groq', model: 'openai/gpt-oss-120b (automático)', placeholder: 'gsk_…', url: 'https://console.groq.com/keys', desc: 'Recomendado: rápido e gratuito, sem cartão.' },
  gemini: { name: 'Gemini', model: 'gemini-2.5-flash (automático)', placeholder: 'AIza…', url: 'https://aistudio.google.com/apikey', desc: 'Google AI Studio, com cota gratuita.' },
  openrouter: { name: 'OpenRouter', model: 'openai/gpt-oss-20b:free (automático)', placeholder: 'sk-or-…', url: 'https://openrouter.ai/keys', desc: 'Vários modelos, inclusive gratuitos.' },
};
const form = reactive({ provider: 'groq', key: '', model: '' });
const editing = ref(false);
const showKey = ref(false);
const testing = ref(false);
const keyMsg = ref('');
const keyOk = ref(false);

function startEdit() {
  Object.assign(form, { provider: aiKey.value?.provider || 'groq', key: '', model: aiKey.value?.model || '' });
  keyMsg.value = '';
  editing.value = true;
}
async function testAndSave() {
  testing.value = true;
  keyMsg.value = '';
  const candidate = { provider: form.provider, key: form.key, model: form.model || undefined };
  try {
    const r = await $fetch('/api/ai/test', { method: 'POST', headers: aiHeaders(candidate) });
    setAiKey(candidate);
    keyOk.value = true;
    keyMsg.value = `Funcionou! Usando ${r.label} (${r.model}).`;
    editing.value = false;
    form.key = '';
    toast('Chave de IA salva neste navegador');
  } catch (err) {
    keyOk.value = false;
    keyMsg.value = err?.data?.message || err.message;
  } finally {
    testing.value = false;
  }
}
function removeKey() {
  setAiKey(null);
  toast('Chave removida deste navegador');
}
// No site hospedado, só quem administra configura a IA do servidor
const isAdmin = computed(() => auth.value.mode === 'local' || auth.value.user?.isAdmin);
const hidden = ref([]);
const loadHidden = async () => { try { hidden.value = await $fetch('/api/hidden'); } catch {} };
async function restore(h) {
  await unhideJob(h);
  hidden.value = hidden.value.filter((x) => x.url !== h.url);
  toast('A vaga volta a aparecer na próxima busca');
}
onMounted(loadHidden);
</script>
