// Regras de vaga usadas no servidor e na tela: identificar a mesma vaga em fontes diferentes e juntá-las.

export const normText = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palavras que variam entre portais mas não mudam a vaga
const TITLE_NOISE = /\b(remoto|remota|remote|hibrido|hibrida|hybrid|presencial|home ?office|100%|vaga|vagas|oportunidade|pcd|exclusiva|afirmativa|clt|pj|urgente|imediato|brasil|brazil|latam)\b/g;
const COMPANY_NOISE = /\b(ltda|s\/?a|sa|eireli|me|epp|inc|llc|ltd|corp|co|grupo|group|holding|brasil|brazil|do brasil|tecnologia|technologies|technology|servicos|solucoes|consultoria)\b/g;

const titleKey = (title) => normText(title)
  .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // [Suporte], (Remoto)
  .replace(/\s[-–|]\s*(?:[a-z]{0,6}\d{3,}\w*|vaga \d+)\s*$/g, ' ') // "- 7784", "- RHA4067"
  .replace(/#\d+|\b[a-z]{2,4}\d{3,}\b|\b\d{4,}\b/g, ' ') // códigos internos
  .replace(TITLE_NOISE, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const companyKey = (company) => normText(company)
  .replace(/\([^)]*\)/g, ' ')
  .replace(COMPANY_NOISE, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(' ').slice(0, 2).join(' ');

/** Identidade da vaga: mesma empresa + mesmo cargo (com o nível, para não juntar Jr com Sr). */
export function jobFingerprint(title, company) {
  const c = companyKey(company);
  const t = titleKey(title);
  return c && !/^(empresa|confidencial)/.test(c) ? `${c}|${t}` : `?|${t}|${normText(company).slice(0, 30)}`;
}

// Qual link preferir quando a vaga aparece em vários lugares: o da própria empresa primeiro
const SOURCE_PRIORITY = [/\((greenhouse|lever|ashby|workable|smartrecruiters|recruitee)\)/i, /^gupy$/i, /vagas\.com|infojobs|trampos|remotar/i, /indeed|glassdoor/i, /linkedin/i];
export const sourceRank = (source) => {
  const i = SOURCE_PRIORITY.findIndex((re) => re.test(source || ''));
  return i === -1 ? SOURCE_PRIORITY.length : i;
};

/**
 * Junta `b` em `a` (mesma vaga): mantém o melhor link como principal, guarda os outros em `alsoOn`,
 * fica com a descrição mais completa, a modalidade confirmada e a data mais antiga (há quanto tempo está aberta).
 */
export function mergeJob(a, b) {
  const [main, other] = sourceRank(b.source) < sourceRank(a.source) ? [b, a] : [a, b];
  const alsoOn = [...(a.alsoOn || []), ...(b.alsoOn || []), { source: other.source, url: other.url }]
    .filter((x, i, arr) => x.url !== main.url && arr.findIndex((y) => y.url === x.url) === i);
  const merged = { ...other, ...main, alsoOn };
  if (main.mode === 'unknown' && other.mode && other.mode !== 'unknown') { merged.mode = other.mode; merged.verified = true; }
  if ((other.desc || '').length > (main.desc || '').length) merged.desc = other.desc;
  if (merged.applicants == null && other.applicants != null) merged.applicants = other.applicants;
  const dates = [a.date, b.date].filter(Boolean).map((d) => new Date(d).getTime()).filter((t) => !isNaN(t));
  if (dates.length) merged.date = new Date(Math.min(...dates)).toISOString();
  merged.tags = [...new Set([...(main.tags || []), ...(other.tags || [])])];
  if (a.matchScore != null || b.matchScore != null) merged.matchScore = Math.max(a.matchScore ?? 0, b.matchScore ?? 0);
  return merged;
}
