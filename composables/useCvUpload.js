/**
 * Envio e análise do currículo (usado em "Meu currículo" e no primeiro acesso).
 * Lê o arquivo no servidor, analisa com IA (ou com a análise local) e grava o perfil.
 */
export function useCvUpload() {
  const { profile, cvText, toast, aiHeaders, checkKeyError } = useJobFinder();
  const busy = ref(false);
  const busyLabel = ref('');
  const error = ref('');
  const fileName = ref('');

  async function analyze(fromUpload = false) {
    busy.value = true;
    busyLabel.value = 'Analisando seu perfil…';
    error.value = '';
    try {
      const r = checkKeyError(await $fetch('/api/cv/analyze', { method: 'POST', headers: aiHeaders(), body: { text: cvText.value } }));
      delete r.keyError;
      profile.value = { ...r, titles: r.titles || [], keywords: r.keywords || [], areas: r.areas || [] };
      toast(fromUpload ? 'Currículo lido e analisado' : 'Perfil atualizado');
      return true;
    } catch (err) {
      error.value = err?.data?.message || err.message;
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function upload(file) {
    if (!file) return false;
    error.value = '';
    busy.value = true;
    busyLabel.value = 'Lendo o arquivo…';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await $fetch('/api/cv/upload', { method: 'POST', body: fd });
      cvText.value = r.text;
      fileName.value = file.name;
      return await analyze(true);
    } catch (err) {
      error.value = err?.data?.message || err.message || 'Não consegui ler o arquivo.';
      busy.value = false;
      return false;
    }
  }

  return { busy, busyLabel, error, fileName, upload, analyze };
}
