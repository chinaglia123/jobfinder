<template>
  <span :class="cls" :title="title">
    <component :is="icon" class="w-3.5 h-3.5" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script setup>
import { House, Building2, MapPin, CircleHelp } from '@lucide/vue';

const props = defineProps({ mode: { type: String, default: 'unknown' } });
const MAP = {
  remote: { label: 'Remoto', cls: 'badge-ok', icon: House, title: 'Trabalho 100% remoto' },
  hybrid: { label: 'Híbrido', cls: 'badge-warn', icon: Building2, title: 'Parte remoto, parte no escritório' },
  onsite: { label: 'Presencial', cls: 'badge-bad', icon: MapPin, title: 'Trabalho presencial' },
  unknown: { label: 'A confirmar', cls: 'badge-neutral', icon: CircleHelp, title: 'A vaga não diz claramente a modalidade' },
};
const m = computed(() => MAP[props.mode] || MAP.unknown);
const label = computed(() => m.value.label);
const cls = computed(() => m.value.cls);
const icon = computed(() => m.value.icon);
const title = computed(() => m.value.title);
</script>
