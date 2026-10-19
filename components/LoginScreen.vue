<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
    <!-- Apresentação -->
    <section class="px-4 pt-8 pb-6 lg:px-14 lg:py-14 lg:border-r border-line bg-surface lg:min-h-screen flex flex-col">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-accent text-white dark:text-bg grid place-items-center"><Radar class="w-5 h-5" /></div>
          <div class="leading-tight">
            <div class="font-bold text-[17px]">JobFinder</div>
            <div class="text-[12px] text-subtle">vagas que ninguém achou</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div class="my-auto pt-8 lg:pt-12 max-w-xl">
        <h1 class="text-[28px] leading-[1.15] lg:text-[40px] font-bold tracking-tight">
          Todas as vagas num lugar só, e um currículo certo para cada uma.
        </h1>
        <p class="text-muted text-[15px] lg:text-[17px] mt-3 lg:mt-4">
          Envie seu currículo e a gente procura ao mesmo tempo em {{ sourceCount }} fontes, além dos sites de carreira das empresas. Cada vaga ganha uma nota de quanto combina com você.
        </p>

        <ul class="mt-6 lg:mt-8 grid gap-3 sm:grid-cols-2" :class="!showAll && 'max-lg:hidden'">
          <li v-for="f in FEATURES" :key="f.title" class="flex gap-3">
            <div class="w-9 h-9 rounded-xl bg-accent-soft text-accent grid place-items-center shrink-0"><component :is="f.icon" class="w-[18px] h-[18px]" /></div>
            <div class="min-w-0">
              <div class="font-semibold text-[14px]">{{ f.title }}</div>
              <div class="text-[13px] text-muted">{{ f.text }}</div>
            </div>
          </li>
        </ul>
        <button v-if="!showAll" class="lg:hidden mt-4 text-[13px] font-semibold text-accent" @click="showAll = true">Ver o que dá para fazer</button>

        <div class="mt-6 lg:mt-8 flex flex-wrap gap-1.5" aria-label="Algumas das fontes">
          <span v-for="s in SOURCES_SHOWN" :key="s" class="badge-neutral">{{ s }}</span>
          <span class="badge-neutral">+ empresas</span>
        </div>
      </div>
    </section>

    <!-- Entrar / criar conta -->
    <section class="px-4 py-8 lg:py-14 grid place-items-center">
      <div class="w-full max-w-sm">
        <h2 class="text-[20px] font-bold tracking-tight mb-1">{{ tab === 'login' ? 'Entrar' : 'Criar sua conta' }}</h2>
        <p class="text-[13px] text-muted mb-5">{{ tab === 'login' ? 'Bom te ver de novo.' : 'É grátis e leva menos de um minuto.' }}</p>

        <div class="card p-6">
          <div class="segmented w-full mb-5" role="group" aria-label="Entrar ou criar conta">
            <button type="button" class="flex-1" :aria-pressed="tab === 'register'" @click="tab = 'register'">Criar conta</button>
            <button type="button" class="flex-1" :aria-pressed="tab === 'login'" @click="tab = 'login'">Entrar</button>
          </div>

          <form class="space-y-3.5" @submit.prevent="submit">
            <div v-if="tab === 'register'">
              <label class="label" for="name">Seu nome</label>
              <input id="name" v-model="name" class="input" autocomplete="name" />
            </div>
            <div>
              <label class="label" for="email">E-mail</label>
              <input id="email" v-model="email" type="email" required class="input" autocomplete="email" />
            </div>
            <div>
              <label class="label" for="pass">Senha</label>
              <div class="relative">
                <input
                  id="pass"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  class="input pr-10"
                  :autocomplete="tab === 'login' ? 'current-password' : 'new-password'"
                  :minlength="tab === 'register' ? 8 : undefined"
                />
                <button
                  type="button"
                  class="absolute right-1 top-1/2 -translate-y-1/2 btn-icon btn-ghost h-8 w-8 text-subtle hover:text-ink"
                  :aria-label="showPassword ? 'Esconder senha' : 'Mostrar senha'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" class="w-4 h-4" />
                  <Eye v-else class="w-4 h-4" />
                </button>
              </div>
              <p v-if="tab === 'register'" class="text-[12px] text-subtle mt-1">Mínimo de 8 caracteres.</p>
            </div>
            <div v-if="tab === 'register'">
              <label class="label" for="pass-confirm">Confirmar senha</label>
              <div class="relative">
                <input
                  id="pass-confirm"
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  required
                  class="input pr-10"
                  :class="confirmPassword && password !== confirmPassword ? 'border-bad focus:border-bad' : ''"
                  autocomplete="new-password"
                  minlength="8"
                />
                <button
                  type="button"
                  class="absolute right-1 top-1/2 -translate-y-1/2 btn-icon btn-ghost h-8 w-8 text-subtle hover:text-ink"
                  :aria-label="showConfirmPassword ? 'Esconder confirmação de senha' : 'Mostrar confirmação de senha'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                  <Eye v-else class="w-4 h-4" />
                </button>
              </div>
              <p v-if="confirmPassword && password !== confirmPassword" class="text-[12px] text-bad mt-1">
                As senhas ainda não coincidem.
              </p>
              <p v-else-if="confirmPassword && password.length >= 8 && password === confirmPassword" class="text-[12px] text-ok mt-1">
                Senhas conferem.
              </p>
            </div>
            <div v-if="tab === 'register' && auth.inviteRequired">
              <label class="label" for="invite">Código de convite</label>
              <input id="invite" v-model="invite" class="input" required />
              <p class="text-[12px] text-subtle mt-1">Quem te mandou o link tem esse código.</p>
            </div>

            <p v-if="error" class="flex gap-2 text-[13px] text-bad"><CircleAlert class="w-4 h-4 shrink-0 mt-0.5" />{{ error }}</p>

            <button type="submit" class="btn-primary w-full h-10" :disabled="busy || (tab === 'register' && Boolean(confirmPassword) && password !== confirmPassword)">
              <LoaderCircle v-if="busy" class="w-4 h-4 animate-spin" />
              {{ tab === 'login' ? 'Entrar' : 'Criar conta e começar' }}
            </button>
          </form>
        </div>

        <p class="text-[12px] text-subtle text-center mt-4">
          Seu currículo e suas candidaturas ficam visíveis só para você.
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { Radar, CircleAlert, LoaderCircle, Layers, Target, FileCheck2, ShieldCheck, KanbanSquare, Sparkles, Eye, EyeOff } from '@lucide/vue';

const { auth, info, login, register } = useJobFinder();

const FEATURES = [
  { icon: Layers, title: 'Busca em todo lugar', text: 'LinkedIn, Gupy, Catho, InfoJobs e sites de carreira das empresas, de uma vez.' },
  { icon: Target, title: 'Match com você', text: 'Cada vaga ganha uma nota pelo seu currículo, e as melhores vêm primeiro.' },
  { icon: FileCheck2, title: 'Currículo sob medida', text: 'Uma versão para cada vaga, com a nota que ela tira no filtro automático (ATS).' },
  { icon: ShieldCheck, title: 'Alerta de golpe', text: 'Vagas suspeitas e vagas fantasma aparecem marcadas ou somem da lista.' },
  { icon: KanbanSquare, title: 'Funil de candidaturas', text: 'Acompanhe onde você se candidatou e o que fazer em seguida.' },
  { icon: Sparkles, title: 'Copiloto com IA', text: 'Peça em português: "vagas de CRM remotas da última semana".' },
];
const SOURCES_SHOWN = ['LinkedIn', 'Gupy', 'Catho', 'InfoJobs', 'Vagas.com', 'Empregos.com.br', 'Remotar', 'Trampos'];
const sourceCount = computed(() => Math.max(15, info.value?.sources?.length || 0));

// Quem chega pelo link de convite geralmente ainda não tem conta
const tab = ref('register');
const showAll = ref(false);
const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const invite = ref('');
const busy = ref(false);
const error = ref('');

watch(tab, () => {
  error.value = '';
});

onMounted(() => {
  // Link com ?convite=CODIGO já preenche o código
  const code = new URLSearchParams(location.search).get('convite');
  if (code) invite.value = code;
});

async function submit() {
  error.value = '';
  if (tab.value === 'register') {
    if (password.value.length < 8) {
      error.value = 'A senha precisa ter pelo menos 8 caracteres.';
      return;
    }
    if (password.value !== confirmPassword.value) {
      error.value = 'As senhas não coincidem. Verifique e tente novamente.';
      return;
    }
  }
  busy.value = true;
  try {
    if (tab.value === 'login') await login(email.value, password.value);
    else await register({ name: name.value, email: email.value, password: password.value, invite: invite.value });
  } catch (err) {
    error.value = err?.data?.message || err.message;
  } finally {
    busy.value = false;
  }
}
</script>
