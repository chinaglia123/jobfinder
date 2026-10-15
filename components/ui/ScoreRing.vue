<template>
  <div class="relative shrink-0 grid place-items-center" :style="{ width: px + 'px', height: px + 'px' }" :title="`Compatibilidade com seu currículo: ${value}%`">
    <svg :width="px" :height="px" :viewBox="`0 0 ${px} ${px}`" class="-rotate-90">
      <circle :cx="px / 2" :cy="px / 2" :r="r" fill="none" stroke="rgb(var(--border))" :stroke-width="stroke" />
      <circle
        :cx="px / 2" :cy="px / 2" :r="r" fill="none" :stroke="color" :stroke-width="stroke" stroke-linecap="round"
        :stroke-dasharray="circ" :stroke-dashoffset="circ * (1 - Math.max(0, Math.min(100, value)) / 100)"
        style="transition: stroke-dashoffset .5s ease"
      />
    </svg>
    <span class="absolute font-bold tabular-nums" :class="size === 'lg' ? 'text-[17px]' : 'text-[12px]'" :style="{ color }">{{ value }}<span v-if="size === 'lg'" class="text-[11px]">%</span></span>
  </div>
</template>

<script setup>
const props = defineProps({ value: { type: Number, default: 0 }, size: { type: String, default: 'md' } });
const px = computed(() => (props.size === 'lg' ? 64 : 40));
const stroke = computed(() => (props.size === 'lg' ? 5 : 3.5));
const r = computed(() => px.value / 2 - stroke.value);
const circ = computed(() => 2 * Math.PI * r.value);
// Verde = forte, azul = razoável, âmbar = fraco
const color = computed(() => (props.value >= 70 ? 'rgb(var(--ok))' : props.value >= 45 ? 'rgb(var(--accent))' : 'rgb(var(--warn))'));
</script>
