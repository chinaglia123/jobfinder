# Como colocar o JobFinder no ar (grátis: Vercel + Turso)

Tempo estimado: 20–30 minutos. Você vai precisar de três contas gratuitas: **GitHub**, **Turso** e **Vercel**
(dá para entrar no Turso e na Vercel com a própria conta do GitHub). Nenhuma pede cartão.

---

## 1. Subir o projeto para o GitHub

1. Crie um repositório **privado** em https://github.com/new (ex: `jobfinder`). Não marque README nem .gitignore.
2. Na pasta do projeto, rode (o GitHub mostra esses mesmos comandos depois de criar o repositório):

```bash
git init
git add .
git commit -m "JobFinder"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/jobfinder.git
git push -u origin main
```

O `.gitignore` já impede que o banco local (`.data`), o `.env` (chaves) e as pastas pesadas sejam enviados.

## 2. Criar o banco no Turso

1. Entre em https://app.turso.tech e crie um banco (ex: `jobfinder`). Escolha a região mais próxima do Brasil.
2. Na página do banco, copie a **URL** (começa com `libsql://`).
3. Clique em **Create Token** (permissão de leitura e escrita) e copie o token.

As tabelas são criadas sozinhas no primeiro acesso.

## 3. Publicar na Vercel

1. Em https://vercel.com/new, importe o repositório do GitHub. A Vercel reconhece o Nuxt sozinha.
2. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `JOBFINDER_MODE` | `hosted` |
| `TURSO_DATABASE_URL` | a URL do passo 2 (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | o token do passo 2 |
| `CRON_SECRET` | uma senha longa e aleatória (ex: gere em https://1password.com/password-generator) |
| `JOBFINDER_CONVITE` | *(opcional)* um código que as pessoas precisam digitar para criar conta |
| `GROQ_API_KEY` | *(opcional)* chave de IA do site. Sem ela, cada pessoa usa a própria chave em Ajustes |

3. Clique em **Deploy**. Ao terminar, a Vercel mostra o endereço do site (ex: `https://jobfinder-xyz.vercel.app`).

## 4. Primeiro acesso

1. Abra o site e **crie a sua conta primeiro** — a primeira conta vira a administradora.
2. Vá em **Empresas e fontes → Atualizar agora** para baixar as vagas das empresas pela primeira vez (leva 1–3 minutos).
3. Mande o link para quem quiser usar. Se definiu `JOBFINDER_CONVITE`, mande o código junto.

## 5. Atualização automática das vagas (recomendado)

O cron gratuito da Vercel roda **uma vez por dia** (às 6h de Brasília). Para atualizar **a cada 6 horas**:

1. No GitHub, abra o repositório → **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `SITE_URL` = o endereço do site (ex: `https://jobfinder-xyz.vercel.app`)
   - `CRON_SECRET` = o mesmo valor colocado na Vercel
2. Abra a aba **Actions**, escolha **Indexar vagas** e clique em **Run workflow** para testar.

---

## Bom saber

- **Plano gratuito da Vercel (Hobby):** é para uso pessoal, não comercial. Cada busca pode levar até ~40s (o limite é 300s).
- **Plano gratuito do Turso:** 5 GB e milhões de leituras/gravações por mês — muito acima do que o app usa.
- **LinkedIn:** a partir de servidores na nuvem ele bloqueia mais rápido. As outras fontes seguem funcionando.
  Quem quiser **Indeed e Glassdoor** baixa o agente local em *Empresas e fontes* (o zip já vem configurado para o seu site).
- **Chaves de IA:** em *Ajustes*, cada pessoa pode usar a própria chave gratuita (fica só no navegador dela).
- **Atualizar o site:** basta enviar mudanças para o GitHub (`git push`); a Vercel publica sozinha.
- **Rodar no seu computador** continua igual: `npm run dev` (usa o banco local em `.data`, sem login).
