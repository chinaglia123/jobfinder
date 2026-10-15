import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

const MAX_BYTES = 8 * 1024 * 1024;

// Recebe o currículo (PDF, DOCX ou TXT) e devolve o texto extraído.
// A análise continua em /api/cv/analyze, para o usuário poder revisar o texto antes.
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  const file = parts?.find((p) => p.name === 'file' && p.data?.length);
  if (!file) throw createError({ statusCode: 400, message: 'Nenhum arquivo recebido.' });
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, message: 'Arquivo muito grande (máximo 8 MB).' });

  const name = (file.filename || '').toLowerCase();
  const type = file.type || '';
  let text = '';

  try {
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(file.data));
      const r = await extractText(pdf, { mergePages: true });
      text = Array.isArray(r.text) ? r.text.join('\n') : r.text;
    } else if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(file.data) })).value;
    } else if (name.endsWith('.txt') || name.endsWith('.md') || type.startsWith('text/')) {
      text = Buffer.from(file.data).toString('utf8');
    } else {
      throw createError({ statusCode: 415, message: 'Formato não suportado. Envie PDF, DOCX ou TXT.' });
    }
  } catch (e: any) {
    if (e.statusCode) throw e;
    throw createError({ statusCode: 422, message: 'Não consegui ler esse arquivo. Tente exportar o currículo como PDF novamente ou cole o texto.' });
  }

  // Normaliza espaços sem perder as quebras de linha (ajudam a achar nome e cargos)
  text = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 40) {
    throw createError({ statusCode: 422, message: 'O arquivo parece ser uma imagem escaneada (sem texto selecionável). Cole o texto do currículo no campo abaixo.' });
  }
  return { text, chars: text.length, filename: file.filename };
});
