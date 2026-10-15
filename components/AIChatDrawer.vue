<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition-opacity" leave-active-class="transition-opacity">
      <div v-if="open" class="fixed inset-0 z-40 bg-black/30" @click="$emit('close')"></div>
    </Transition>
    <aside
      class="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-surface border-l border-line shadow-pop flex flex-col transition-transform duration-300 ease-out"
      :class="open ? 'translate-x-0' : 'translate-x-full'"
      role="dialog" aria-label="Copiloto IA" :inert="!open"
    >
      <div class="flex items-center gap-3 h-16 px-4 border-b border-line">
        <div class="w-9 h-9 rounded-xl bg-accent-soft text-accent grid place-items-center"><Sparkles class="w-5 h-5" /></div>
        <div class="flex-1">
          <div class="font-semibold">Copiloto</div>
          <div class="text-[12px] text-muted">Ajusta filtros e busca por você</div>
        </div>
        <button class="btn-icon btn-ghost" aria-label="Fechar" @click="$emit('close')"><X class="w-5 h-5" /></button>
      </div>

      <div ref="logRef" class="flex-1 overflow-y-auto p-4 space-y-3 scroll-thin">
        <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap"
            :class="m.role === 'user' ? 'bg-accent text-white dark:text-bg rounded-br-md' : 'bg-surface-2 rounded-bl-md'"
          >{{ m.content }}</div>
        </div>
        <div v-if="loading" class="flex items-center gap-2 text-[13px] text-muted"><LoaderCircle class="w-4 h-4 animate-spin" /> Pensando…</div>
      </div>

      <div class="px-4 pb-2 flex gap-2 overflow-x-auto scroll-thin">
        <button v-for="s in suggestions" :key="s" class="btn-secondary btn-sm shrink-0" @click="send(s)">{{ s }}</button>
      </div>

      <form class="flex gap-2 p-4 border-t border-line" @submit.prevent="send(input)">
        <input v-model="input" class="input" placeholder="Ex: só vagas remotas dos últimos 7 dias" aria-label="Mensagem para o Copiloto" />
        <button type="submit" class="btn-primary btn-icon h-10 w-10 shrink-0" :disabled="!input.trim() || loading" aria-label="Enviar"><Send class="w-4 h-4" /></button>
      </form>
    </aside>
  </Teleport>
</template>

<script setup>
import { Sparkles, X, LoaderCircle, Send } from '@lucide/vue';

defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['close', 'go']);
const { filters, profile, cvText, search, runSearch, aiHeaders, checkKeyError } = useJobFinder();

const input = ref('');
const loading = ref(false);
const logRef = ref(null);
const messages = ref([
  { role: 'assistant', content: 'Oi! Posso mudar os filtros e rodar buscas por você, ou tirar dúvidas sobre seu currículo. O que você procura?' },
]);
const suggestions = ['Só vagas 100% remotas', 'Vagas dos últimos 7 dias', 'Poucas candidaturas', 'Vagas no exterior'];

const scroll = () => nextTick(() => { if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight; });

async function send(text) {
  if (!text.trim() || loading.value) return;
  messages.value.push({ role: 'user', content: text });
  input.value = '';
  loading.value = true;
  scroll();
  try {
    const res = checkKeyError(await $fetch('/api/ai/chat', {
      method: 'POST',
      headers: aiHeaders(),
      body: {
        messages: messages.value,
        cvText: cvText.value,
        filters: filters.value,
        analysis: profile.value,
        jobs: search.value.jobs.slice(0, 10),
      },
    }));
    messages.value.push({ role: 'assistant', content: res.reply || 'Pronto!' });
    const changed = res.filters && Object.keys(res.filters).length;
    if (changed || res.run) {
      emit('go', 'jobs');
      runSearch(changed ? res.filters : null);
    }
  } catch {
    messages.value.push({ role: 'assistant', content: 'Tive um problema de conexão. Tente de novo em instantes.' });
  } finally {
    loading.value = false;
    scroll();
  }
}
</script>
