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
  catho: 'Catho', programathor: 'Programathor',
};

/** Nome curto da fonte (ex: "Stone (Greenhouse)" → "Stone · site da empresa") */
export function sourceLabel(source) {
  const m = /^(.*) \((Greenhouse|Lever|Ashby)\)$/.exec(source || '');
  return m ? 'Site da empresa' : source;
}

const money = (v, currency) => {
  const sym = currency === 'BRL' ? 'R$' : currency === 'EUR' ? '€' : 'US$';
  if (v >= 1000) {
    const k = v / 1000;
    return `${sym} ${k.toLocaleString('pt-BR', { maximumFractionDigits: k < 10 ? 1 : 0 })} mil`;
  }
  return `${sym} ${Math.round(v).toLocaleString('pt-BR')}`;
};

/** Salário informado na vaga, no período original (ex: "R$ 4,5 mil/mês", "US$ 90–110 mil/ano") */
export function formatSalary(s) {
  if (!s) return '';
  const per = { month: '/mês', year: '/ano', hour: '/hora' }[s.period] || '';
  if (s.max && s.max !== s.min) {
    const a = money(s.min, s.currency), b = money(s.max, s.currency);
    // "R$ 4 mil – R$ 6 mil" → "R$ 4–6 mil"
    const m1 = a.match(/^(\S+) ([\d.,]+) mil$/), m2 = b.match(/^(\S+) ([\d.,]+) mil$/);
    return (m1 && m2 ? `${m1[1]} ${m1[2]}–${m2[2]} mil` : `${a} – ${b}`) + per;
  }
  return money(s.min, s.currency) + per;
}

/** Faixa estimada a partir de vagas parecidas */
export function formatEstimate(e) {
  if (!e) return '';
  return formatSalary({ min: e.low, max: e.high, currency: 'BRL', period: 'month' });
}
