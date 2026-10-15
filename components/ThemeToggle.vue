<template>
  <button class="btn-icon btn-ghost" :aria-label="label" :title="label" @click="cycle">
    <Sun v-if="theme === 'light'" class="w-[18px] h-[18px]" />
    <Moon v-else-if="theme === 'dark'" class="w-[18px] h-[18px]" />
    <Monitor v-else class="w-[18px] h-[18px]" />
  </button>
</template>

<script setup>
import { Sun, Moon, Monitor } from '@lucide/vue';

// Ciclo: sistema → claro → escuro. "Sistema" segue a preferência do sistema operacional.
const theme = useState('theme', () => 'system');
const label = computed(() => ({ system: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro' })[theme.value]);

let media = null;
const apply = () => {
  const dark = theme.value === 'dark' || (theme.value === 'system' && media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};
const cycle = () => {
  theme.value = { system: 'light', light: 'dark', dark: 'system' }[theme.value];
  try { localStorage.setItem('jf_theme', theme.value); } catch {}
  apply();
};

onMounted(() => {
  media = window.matchMedia('(prefers-color-scheme: dark)');
  try { theme.value = localStorage.getItem('jf_theme') || 'system'; } catch {}
  apply();
  media.addEventListener('change', apply);
});
onBeforeUnmount(() => media?.removeEventListener('change', apply));
</script>
