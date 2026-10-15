import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { jobDescription } from '../../utils/job-desc';
import { norm, wordRe, detectLang } from '../../utils/search';
import { extractRequirements } from '#shared/ats.js';

/**
 * Currículo adaptado a uma vaga: reorganiza e reescreve o currículo da pessoa usando o vocabulário
 * dos requisitos da vaga — sem inventar experiência, empresa, data, formação ou ferramenta.
 */
const SYSTEM = (lang: string) => `Você é especialista em recrutamento e em sistemas de triagem de currículos (ATS).
Reescreva o currículo da pessoa para a VAGA informada, seguindo estas regras SEM EXCEÇÃO:
1. NUNCA invente nada: nenhuma empresa, cargo, data, formação, certificação, ferramenta, número, porcentagem ou resultado que não esteja no currículo original.
2. NÃO aumente níveis (ex: "Excel" NÃO vira "Excel avançado"; "inglês intermediário" NÃO vira "fluente") e NÃO acrescente benefícios ou efeitos que o original não cita (ex: "otimizando ROI", "aumentando vendas").
3. O "headline" descreve a experiência real (ex: "Profissional de Marketing Digital com foco em CRM"); NÃO use como título um cargo que a pessoa nunca teve.
4. Pode: reordenar, resumir, escolher o que destacar, reescrever frases com verbos de ação e usar as MESMAS PALAVRAS da vaga quando descreverem algo que a pessoa realmente fez.
5. Priorize as experiências e habilidades mais ligadas aos requisitos da vaga. Experiências antigas ou sem relação podem ficar mais curtas.
6. Formato simples e legível por ATS: sem tabelas, sem ícones, títulos padrão.
7. Escreva em ${lang === 'en' ? 'INGLÊS (a vaga está em inglês)' : 'PORTUGUÊS DO BRASIL'}.
8. "keywords_missing": requisitos importantes da vaga que NÃO aparecem no currículo — eles NÃO devem ser colocados no currículo.

Responda SOMENTE com JSON:
{
  "name": "nome da pessoa",
  "headline": "título profissional alinhado à vaga, verdadeiro para a experiência da pessoa",
  "contact": "e-mail · telefone · cidade · LinkedIn (só o que existir no currículo)",
  "summary": "resumo de 3 a 4 linhas focado no que a vaga pede",
  "skills": ["habilidades e ferramentas do currículo, das mais relevantes para a vaga para as menos"],
  "experience": [{ "role": "cargo", "company": "empresa", "period": "período", "bullets": ["realizações e responsabilidades reescritas"] }],
  "education": ["curso — instituição — ano"],
  "certifications": ["..."],
  "languages": ["..."],
  "keywords_covered": ["termos importantes da vaga que o currículo contempla"],
  "keywords_missing": ["termos importantes da vaga que faltam no currículo"],
  "tips": ["2 ou 3 dicas honestas para esta candidatura"]
}`;

/** Sem IA: mantém o texto original e só reorganiza as habilidades pelo que a vaga pede */
function localTailor(job: any, desc: string, cvText: string, profile: any) {
  const jobText = norm(`${job.title} ${desc}`);
  const skills: string[] = [...new Set<string>((profile?.keywords || []).map((s: string) => String(s)))];
  const covered = skills.filter((k) => wordRe(norm(k)).test(jobText));
  const others = skills.filter((k) => !covered.includes(k));
  const lines = cvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const contact = lines.filter((l) => /@|\(?\d{2}\)?\s?\d{4,5}-?\d{4}|linkedin\.com/i.test(l)).slice(0, 2).join(' · ');
  return {
    name: profile?.name || lines[0] || '',
    headline: job.title,
    contact,
    summary: '',
    skills: [...covered, ...others],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    rawText: cvText,
    keywords_covered: covered,
    keywords_missing: [],
    tips: ['Esta é uma versão básica (sem IA): só reordenamos suas habilidades. Configure uma chave de IA em Ajustes para reescrever o currículo para a vaga.'],
  };
}

const list = (v: any) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40) : []);

// ===== Verificação depois da IA: nada que não esteja no currículo original =====
const QUALIFIER = /^(avancad[oa]s?|advanced|intermediari[oa]s?|basic[oa]s?|fluente|fluent|nativ[oa]|native|senior|expert|especialista|proficiente|solid[oa]s?)$/;
const words = (s: string) => norm(s).replace(/[^a-z0-9+#.]+/g, ' ').split(' ').filter((w) => w.length > 2);

/** Remove habilidades que não aparecem no currículo e níveis que o original não afirma (ex: "Excel avançado" → "Excel") */
function checkSkills(skills: string[], cvNorm: string) {
  const kept: string[] = [];
  const removed: string[] = [];
  for (const s of skills) {
    // Tira, palavra por palavra, qualificadores que o currículo original não usa
    const clean = s.split(/\s+/)
      .filter((tok) => { const t = norm(tok).replace(/[^a-z]/g, ''); return !QUALIFIER.test(t) || cvNorm.includes(t); })
      .join(' ').replace(/[\s,;:–-]+$/, '').trim();
    const core = words(clean);
    if (core.length && core.every((w) => cvNorm.includes(w))) kept.push(clean);
    else removed.push(s);
  }
  return { kept: [...new Set(kept)], removed };
}

/** O título não pode trazer um cargo que a pessoa nunca teve: nesse caso usa o cargo mais recente + o foco da vaga */
function checkHeadline(headline: string, cvNorm: string, experience: any[], focus: string[]) {
  const role = headline.split(/\s(?:com|with|em|in|focad[oa]|\|)\s|\s[–—-]\s|,/i)[0];
  const ok = words(role).every((w) => cvNorm.includes(w));
  if (ok && headline) return { headline, changed: false };
  const last = experience.find((e) => e.role)?.role || '';
  const extra = focus.slice(0, 3).join(', ');
  return { headline: [last, extra && `foco em ${extra}`].filter(Boolean).join(' · ') || headline, changed: true };
}

/** Números (anos, %, quantidades) que a IA colocou e não existem no original */
const newNumbers = (text: string, cvNorm: string) =>
  (norm(text).match(/\d+(?:[.,]\d+)?%?/g) || []).filter((n) => !cvNorm.includes(n.replace('%', '')));

export default defineEventHandler(async (event) => {
  const { job, cvText = '', profile = null } = (await readBody(event)) || {};
  if (!job?.title) throw createError({ statusCode: 400, message: 'Vaga não informada.' });
  if (String(cvText).trim().length < 80) throw createError({ statusCode: 400, message: 'Envie seu currículo em "Meu currículo" primeiro.' });

  const desc = (await jobDescription(job)) || job.desc || '';
  const lang = detectLang(job.title, desc) === 'en' ? 'en' : 'pt';
  // O que o sistema de triagem (ATS) da vaga deve procurar: a IA usa esses termos exatos quando forem verdade
  const req = extractRequirements({ title: job.title, desc });
  const atsTerms = [...req.keywords.map((k) => k.term), ...req.titleTerms.map((t) => t.toUpperCase().length <= 4 ? t.toUpperCase() : t)];
  let keyError = null;

  try {
    const ai = await generateAI({
      systemPrompt: SYSTEM(lang),
      messages: [{
        role: 'user',
        content: `VAGA: ${job.title} — ${job.company} (${job.location || ''})
DESCRIÇÃO DA VAGA:
${desc.slice(0, 6000) || '(sem descrição; use o título)'}

TERMOS QUE O SISTEMA DE TRIAGEM (ATS) DESTA VAGA PROCURA:
${atsTerms.join(', ') || '(nenhum identificado)'}
Para cada termo acima que descreva algo que a pessoa REALMENTE fez (mesmo que com outras palavras no currículo),
escreva o termo exatamente como acima (ex: quem criou réguas/fluxos de e-mail de relacionamento fez CRM).
Termos que a pessoa não tem NÃO entram no currículo: vão para "keywords_missing".

CURRÍCULO ORIGINAL:
${String(cvText).slice(0, 12000)}`,
      }],
      json: true,
      temperature: 0.1,
      creds: aiCreds(event),
    });
    keyError = ai.keyError;
    const d = parseJSON(ai.text);
    if (d && (d.summary || d.experience?.length)) {
      const cvNorm = norm(cvText);
      const skills = checkSkills(list(d.skills), cvNorm);
      // Termo da vaga que a IA associou a algo que a pessoa fez (ex: réguas de e-mail → CRM): fica, mas a pessoa confirma
      const atsNorm = atsTerms.map((t) => norm(t));
      const viaAts = skills.removed.filter((r) => atsNorm.includes(norm(r).trim()));
      const dropped = skills.removed.filter((r) => !viaAts.includes(r));
      const warnings: string[] = [];
      const confirm: string[] = viaAts;
      if (dropped.length) warnings.push(`Removemos habilidades que não estão no seu currículo: ${dropped.join(', ')}`);
      const allText = [d.summary, ...(Array.isArray(d.experience) ? d.experience.flatMap((e: any) => list(e?.bullets)) : [])].join(' ');
      const nums = [...new Set(newNumbers(allText, cvNorm))];
      if (nums.length) warnings.push(`Confira estes números, que não estão no seu currículo original: ${nums.join(', ')}`);
      const experience = (Array.isArray(d.experience) ? d.experience : []).slice(0, 12).map((e: any) => ({
        role: String(e?.role || '').trim(), company: String(e?.company || '').trim(), period: String(e?.period || '').trim(),
        bullets: list(e?.bullets).slice(0, 8),
      }));
      const head = checkHeadline(String(d.headline || '').trim(), cvNorm, experience, list(d.keywords_covered));
      if (head.changed) warnings.push('Ajustamos o título para não usar um cargo que não está no seu currículo.');
      return {
        warnings,
        name: String(d.name || profile?.name || '').trim(),
        headline: head.headline,
        contact: String(d.contact || '').trim(),
        summary: String(d.summary || '').trim(),
        skills: [...skills.kept, ...viaAts],
        confirm,
        experience,
        education: list(d.education),
        certifications: list(d.certifications),
        languages: list(d.languages),
        keywords_covered: list(d.keywords_covered),
        keywords_missing: list(d.keywords_missing),
        tips: list(d.tips).slice(0, 4),
        lang,
        jobDesc: desc.slice(0, 8000),
        provider: ai.provider,
        keyError,
      };
    }
  } catch (e) {
    console.warn('[AI:tailor-cv fallback]', e);
  }

  return { ...localTailor(job, desc, String(cvText), profile), lang, jobDesc: desc.slice(0, 8000), provider: 'local', keyError };
});
