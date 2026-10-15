<template>
  <div class="min-h-screen grid place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-2.5 mb-8 justify-center">
        <div class="w-10 h-10 rounded-xl bg-accent text-white dark:text-bg grid place-items-center"><Radar class="w-5 h-5" /></div>
        <div class="leading-tight">
          <div class="font-bold text-[17px]">JobFinder</div>
          <div class="text-[12px] text-subtle">vagas que ninguém achou</div>
        </div>
      </div>

      <div class="card p-6">
        <div class="segmented w-full mb-5" role="group" aria-label="Entrar ou criar conta">
          <button type="button" class="flex-1" :aria-pressed="tab === 'login'" @click="tab = 'login'">Entrar</button>
          <button type="button" class="flex-1" :aria-pressed="tab === 'register'" @click="tab = 'register'">Criar conta</button>
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
            <input id="pass" v-model="password" type="password" required class="input" :autocomplete="tab === 'login' ? 'current-password' : 'new-password'" :minlength="tab === 'register' ? 8 : undefined" />
            <p v-if="tab === 'register'" class="text-[12px] text-subtle mt-1">Mínimo de 8 caracteres.</p>
          </div>
          <div v-if="tab === 'register' && auth.inviteRequired">
            <label class="label" for="invite">Código de convite</label>
            <input id="invite" v-model="invite" class="input" required />
          </div>

          <p v-if="error" class="flex gap-2 text-[13px] text-bad"><CircleAlert class="w-4 h-4 shrink-0 mt-0.5" />{{ error }}</p>

          <button type="submit" class="btn-primary w-full h-10" :disabled="busy">
            <LoaderCircle v-if="busy" class="w-4 h-4 animate-spin" />
            {{ tab === 'login' ? 'Entrar' : 'Criar conta e começar' }}
          </button>
        </form>
      </div>

      <p class="text-[12px] text-subtle text-center mt-4">
        Seu currículo e suas candidaturas ficam visíveis só para você.
      </p>
    </div>
  </div>
</template>

<script setup>
import { Radar, CircleAlert, LoaderCircle } from '@lucide/vue';

const emit = defineEmits(['done']);
const { auth, login, register } = useJobFinder();

const tab = ref('login');
const name = ref('');
const email = ref('');
const password = ref('');
const invite = ref('');
const busy = ref(false);
const error = ref('');

async function submit() {
  busy.value = true;
  error.value = '';
  try {
    if (tab.value === 'login') await login(email.value, password.value);
    else await register({ name: name.value, email: email.value, password: password.value, invite: invite.value });
    emit('done');
  } catch (err) {
    error.value = err?.data?.message || err.message;
  } finally {
    busy.value = false;
  }
}
</script>
