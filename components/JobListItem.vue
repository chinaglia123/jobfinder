<template>
  <article
    class="group relative flex gap-3 p-3.5 rounded-2xl border cursor-pointer transition-colors"
    :class="selected ? 'bg-accent-soft/60 border-accent/40' : 'bg-surface border-line hover:border-subtle/50'"
    tabindex="0"
    :aria-current="selected ? 'true' : undefined"
    @click="$emit('select')"
    @keydown.enter.prevent="$emit('select')"
  >
    <UiCompanyAvatar :name="job.company" />
    <div class="min-w-0 flex-1">
      <h3 class="font-semibold text-[15px] leading-snug line-clamp-2">{{ job.title }}</h3>
      <p class="mt-0.5 text-[13px] text-muted truncate">
        {{ job.company }}<span v-if="job.location" class="text-subtle"> · {{ job.location }}</span>
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <UiModeBadge :mode="job.mode" />
        <span v-if="job.applicants != null && job.applicants <= 50" class="badge-accent"><Flame class="w-3.5 h-3.5" />{{ job.applicants }} candidatos</span>
        <span v-else-if="job.fewApplicants" class="badge-accent"><Flame class="w-3.5 h-3.5" />Nova</span>
        <span v-if="job.lang === 'en' || job.lang === 'es'" class="badge-neutral" :title="job.lang === 'en' ? 'Vaga em inglês' : 'Vaga em espanhol'">{{ job.lang.toUpperCase() }}</span>
        <span v-for="c in contracts" :key="c" class="badge-neutral">{{ c }}</span>
        <span class="text-[12px] text-subtle">{{ source }}<template v-if="ago"> · {{ ago }}</template><template v-if="job.related"> · cargo relacionado</template></span>
      </div>
    </div>
    <div class="flex flex-col items-end justify-between gap-2 shrink-0">
      <UiScoreRing v-if="job.matchScore != null" :value="job.matchScore" />
      <span v-else class="w-10"></span>
      <div class="flex items-center">
      <button
        class="grid place-items-center w-8 h-8 rounded-lg text-subtle hover:text-bad hover:bg-bad-soft transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        aria-label="Não tenho interesse (ocultar vaga)"
        title="Não tenho interesse — ocultar"
        @click.stop="$emit('hide')"
      >
        <EyeOff class="w-[18px] h-[18px]" />
      </button>
      <button
        class="grid place-items-center w-8 h-8 rounded-lg transition-colors"
        :class="saved ? 'text-accent' : 'text-subtle hover:text-ink hover:bg-surface-2'"
        :aria-label="saved ? 'Vaga salva' : 'Salvar vaga'"
        :title="saved ? 'Salva nas candidaturas' : 'Salvar nas candidaturas'"
        @click.stop="$emit('save')"
      >
        <BookmarkCheck v-if="saved" class="w-[18px] h-[18px]" />
        <Bookmark v-else class="w-[18px] h-[18px]" />
      </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { Bookmark, BookmarkCheck, Flame, EyeOff } from '@lucide/vue';

const props = defineProps({
  job: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  saved: { type: Boolean, default: false },
});
defineEmits(['select', 'save', 'hide']);
const ago = computed(() => timeAgo(props.job.date));
const source = computed(() => sourceLabel(props.job.source));
const CONTRACT_LABEL = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', freela: 'Freela', temporario: 'Temporária' };
const contracts = computed(() => (props.job.contract || []).slice(0, 2).map((c) => CONTRACT_LABEL[c] || c));
</script>
