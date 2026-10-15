<template>
  <div
    class="avatar shrink-0 grid place-items-center font-bold select-none"
    :class="size === 'lg' ? 'w-12 h-12 rounded-xl text-[15px]' : size === 'sm' ? 'w-8 h-8 rounded-lg text-[11px]' : 'w-10 h-10 rounded-xl text-[13px]'"
    :style="{ '--h': hue }"
    aria-hidden="true"
  >{{ initials }}</div>
</template>

<script setup>
// Iniciais da empresa com uma cor estável derivada do nome (não dependemos de logos externos)
const props = defineProps({ name: { type: String, default: '' }, size: { type: String, default: 'md' } });

const initials = computed(() => {
  const words = (props.name || '?').replace(/[^\p{L}\p{N}\s&]/gu, ' ').split(/\s+/).filter((w) => w && !/^(de|da|do|e|the|of|inc|ltda|sa|s\/a)$/i.test(w));
  return ((words[0]?.[0] || '?') + (words[1]?.[0] || '')).toUpperCase();
});
const hue = computed(() => {
  let h = 0;
  for (const c of props.name || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
});
</script>
