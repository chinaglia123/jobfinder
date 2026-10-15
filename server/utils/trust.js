// Confiança nas vagas: sinais de golpe, sinais de "vaga fantasma" e salário informado.
// São sinais, não certezas: a tela mostra os motivos para a pessoa decidir.
import { normText } from '#shared/jobs.js';

// [expressão, peso, motivo]. Peso 3 = sinal forte sozinho; 1–2 = precisa de outros sinais.
const SCAM_RULES = [
  [/taxa de (inscricao|cadastro|adesao|matricula)|pag(ar|ue|amento de) (uma )?taxa|investimento inicial|kit (inicial|de trabalho)|adquirir (o|um) kit|deposito antecipado|valor do treinamento|treinamento pago|curso (obrigatorio )?pago para/, 3, 'Pede pagamento para participar'],
  [/digitac(ao|oes) (de textos? )?(em casa|online)|digitador(a)? (online|home)|avaliador(a)? de produtos|avaliar produtos (online|em casa)|curtir (videos|posts)|tarefas (simples )?(no|pelo) (app|aplicativo)|montagem de (canetas|bijuterias|pecas) em casa|embalar produtos em casa/, 3, 'Formato típico de golpe (tarefas simples em casa)'],
  [/(ganhe|renda de|lucre|fature) (ate |mais de )?r\$ ?[\d.,]+ (por|ao|a cada) (dia|semana|hora)|dinheiro (rapido|facil)|ganhos? ilimitados?|independencia financeira/, 2, 'Promete ganhos fáceis ou altos demais'],
  [/marketing multinivel|marketing de rede|seja (o )?seu proprio (chefe|patrao)|monte sua equipe|revendedor(a)? independente|piramide|opcoes binarias|forex|day trade|criptomoedas? com retorno/, 2, 'Parece venda em pirâmide / multinível ou investimento'],
  [/[a-z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|bol|uol|live|icloud)\.com/, 1, 'Contato por e-mail pessoal (gmail, hotmail…) em vez do da empresa — comum em empresas pequenas, mas confira'],
  [/(chame|chama|envie|mande|fale|contato|curriculo).{0,40}(whats ?app|zap)\b|wa\.me\//, 1, 'Pede contato só por WhatsApp'],
  [/sem experiencia.{0,60}(ganhe|r\$ ?\d)|nao precisa de experiencia.{0,60}(ganhe|r\$ ?\d)/, 1, 'Sem exigência nenhuma e com ganho em destaque'],
];

/** Sinais de golpe: { level: 0 (nenhum) a 3 (alto), reasons: [...] } */
export function scamSignals(j) {
  const text = normText(`${j.title} ${j.company} ${j.desc || ''}`);
  let score = 0;
  const reasons = [];
  for (const [re, weight, reason] of SCAM_RULES) {
    if (re.test(text)) { score += weight; reasons.push(reason); }
  }
  // Empresa sem nome somada a qualquer outro sinal pesa mais
  if (score && /^(empresa )?confidencial|^empresa \(/.test(normText(j.company))) { score += 1; reasons.push('Empresa não identificada'); }
  return { level: score >= 3 ? 3 : score, reasons };
}

const TALENT_POOL = /banco de talentos|talent (pool|community)|cadastro reserva|oportunidades futuras|vagas? futuras|evergreen|always hiring|candidatura espontanea/;

/**
 * Sinais de "vaga fantasma" (anúncio que não leva a contratação):
 * banco de talentos, aberta há muito tempo, repostada várias vezes.
 * `history` = { first_seen, postings } da mesma vaga (mesma empresa + cargo), se o índice já a viu antes.
 */
export function ghostSignals(j, history) {
  const reasons = [];
  let score = 0;
  if (TALENT_POOL.test(normText(`${j.title} ${(j.desc || '').slice(0, 600)}`))) { score += 2; reasons.push('É um "banco de talentos", não uma vaga com contratação imediata'); }
  const posted = j.date ? new Date(j.date).getTime() : NaN;
  const firstSeen = history?.first_seen ? Number(history.first_seen) : NaN;
  const oldest = Math.min(...[posted, firstSeen].filter((t) => !isNaN(t)));
  const days = isFinite(oldest) ? Math.floor((Date.now() - oldest) / 864e5) : null;
  if (days != null && days > 90) { score += 2; reasons.push(`Aberta há ${days} dias`); }
  else if (days != null && days > 45) { score += 1; reasons.push(`Aberta há ${days} dias`); }
  if (history?.postings >= 3) { score += 1; reasons.push(`Publicada ${history.postings} vezes pela mesma empresa`); }
  return { level: Math.min(3, score), reasons, days };
}

// ===== Salário =====
const MONEY = /(r\$|brl|us\$|usd|\$|€|eur)\s*([\d.,]+)\s*(mil|k)?(?:\s*(?:a|-|até|ate|to)\s*(?:r\$|brl|us\$|usd|\$|€|eur)?\s*([\d.,]+)\s*(mil|k)?)?(?:\s*(?:\/|por|per|ao|a)\s*(mes|month|monthly|ano|year|yearly|annual|hora|hour|hourly))?/i;

const toNumber = (s, mult) => {
  if (!s) return null;
  let v = s.trim();
  // 5.000,00 → 5000.00 ; 5,000.00 → 5000.00 ; 5.5 (mil) → 5.5
  if (/\d\.\d{3}(,|$)/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/\d,\d{3}(\.|$)/.test(v)) v = v.replace(/,/g, '');
  else v = v.replace(',', '.');
  const n = parseFloat(v);
  if (!isFinite(n)) return null;
  return /mil|k/i.test(mult || '') ? n * 1000 : n;
};

/** Salário informado na vaga (etiquetas ou descrição): { min, max, currency, period, monthly } ou null */
export function parseSalary(j) {
  const text = `${(j.tags || []).join(' · ')} · ${(j.desc || '').slice(0, 4000)}`;
  const m = text.match(MONEY);
  if (!m) return null;
  const sym = m[1].toLowerCase();
  const currency = /r\$|brl/.test(sym) ? 'BRL' : /€|eur/.test(sym) ? 'EUR' : 'USD';
  let min = toNumber(m[2], m[3]);
  let max = toNumber(m[4], m[5] || m[3]) || null;
  if (!min || min < 100) return null; // "R$ 10" de benefício etc.
  if (max && max < min) [min, max] = [max, min];
  const p = (m[6] || '').toLowerCase();
  let period = /hora|hour/.test(p) ? 'hour' : /ano|year|annual/.test(p) ? 'year' : /mes|month/.test(p) ? 'month' : null;
  // Sem período escrito: valores altos em dólar/euro costumam ser anuais; em real, mensais
  if (!period) period = currency !== 'BRL' && min >= 15000 ? 'year' : 'month';
  const factor = period === 'year' ? 1 / 12 : period === 'hour' ? 160 : 1;
  const monthlyMin = Math.round(min * factor);
  // Faixas absurdas (ex: faturamento da empresa citado na descrição) são ignoradas
  if (currency === 'BRL' && (monthlyMin < 800 || monthlyMin > 80000)) return null;
  return { min, max, currency, period, monthlyMin, monthlyMax: max ? Math.round(max * factor) : null };
}
