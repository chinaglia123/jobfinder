// Formatações usadas em vários componentes
export function timeAgo(date) {
  if (!date) return '';
  const t = new Date(typeof date === 'number' && date < 1e12 ? date * 1000 : date).getTime();
  if (!t || isNaN(t)) return '';
  const h = Math.round((Date.now() - t) / 36e5);
  if (h < 1) return 'agora';
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d}d`;
  const m = Math.round(d / 30);
  return m < 12 ? `há ${m} ${m === 1 ? 'mês' : 'meses'}` : 'há mais de 1 ano';
}

export const SOURCE_LABELS = {
  empresas: 'Sites das empresas', gupy: 'Gupy', linkedin: 'LinkedIn', remotar: 'Remotar', trampos: 'Trampos',
  himalayas: 'Himalayas', getonbrd: 'Get on Board', remotive: 'Remotive', jobicy: 'Jobicy',
  indeed: 'Indeed', glassdoor: 'Glassdoor', agente: 'Agente local', vagascom: 'Vagas.com', infojobs: 'InfoJobs',
};

/** Nome curto da fonte (ex: "Stone (Greenhouse)" → "Stone · site da empresa") */
export function sourceLabel(source) {
  const m = /^(.*) \((Greenhouse|Lever|Ashby)\)$/.exec(source || '');
  return m ? 'Site da empresa' : source;
}
