<template>
  <div
    class="flex flex-wrap items-center gap-1.5 min-h-10 w-full bg-surface border border-line rounded-xl px-2 py-1.5 cursor-text transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
    @click="inputRef?.focus()"
  >
    <span v-for="(item, i) in modelValue" :key="item + i" class="chip max-w-full" :title="item">
      <span class="truncate">{{ item }}</span>
      <button type="button" class="grid place-items-center w-5 h-5 rounded-md text-subtle hover:text-ink hover:bg-line/60" :aria-label="`Remover ${item}`" @click.stop="remove(i)">
        <X class="w-3.5 h-3.5" />
      </button>
    </span>
    <input
      ref="inputRef"
      v-model="draft"
      :placeholder="modelValue.length ? addPlaceholder : placeholder"
      class="flex-1 min-w-[140px] h-7 bg-transparent text-[14px] text-ink placeholder:text-subtle focus:outline-none"
      :aria-label="ariaLabel"
      @keydown.enter.prevent="commit(true)"
      @keydown="onKey"
      @blur="commit(false)"
      @paste="onPaste"
    />
  </div>
</template>

<script setup>
import { X } from '@lucide/vue';

// Lista de termos editável: Enter ou vírgula adiciona, Backspace no campo vazio remove o último
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  addPlaceholder: { type: String, default: 'Adicionar…' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'submit']);
const draft = ref('');
const inputRef = ref(null);

const add = (raw) => {
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const next = [...props.modelValue];
  for (const it of items) if (!next.some((x) => x.toLowerCase() === it.toLowerCase())) next.push(it);
  if (next.length !== props.modelValue.length) emit('update:modelValue', next);
};
const commit = (submitIfEmpty) => {
  if (draft.value.trim()) { add(draft.value); draft.value = ''; }
  else if (submitIfEmpty) emit('submit');
};
const remove = (i) => emit('update:modelValue', props.modelValue.filter((_, k) => k !== i));
const onKey = (e) => {
  if (e.key === ',') { e.preventDefault(); commit(false); }
  else if (e.key === 'Backspace' && !draft.value && props.modelValue.length) remove(props.modelValue.length - 1);
};
const onPaste = (e) => {
  const t = e.clipboardData?.getData('text') || '';
  if (t.includes(',')) { e.preventDefault(); add(t); }
};
</script>
