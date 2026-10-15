const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const post = (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json());

let analysis = null, jobs = [], messages = [];
const AREA_TERMS = {
  'TI / Tecnologia': ['desenvolvedor', 'analista de sistemas'], Marketing: ['marketing', 'social media'],
  Financeiro: ['analista financeiro', 'contábil'], Administrativo: ['assistente administrativo', 'auxiliar administrativo'],
  'Vendas / Comercial': ['vendedor', 'sales'], RH: ['recursos humanos', 'recrutador'], Logística: ['logística', 'supply chain'], Design: ['designer', 'ux'],
};

// persistência local
const save = () => localStorage.setItem('jf', JSON.stringify({ cv: $('cvText').value, f: getFilters(true) }));
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('jf') || '{}');
    if (s.cv) $('cvText').value = s.cv;
    if (s.f) setFilters(s.f);
  } catch {}
}

function getFilters(raw) {
  let queries = $('queries').value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!queries.length && !raw) {
    queries = $('area').value ? AREA_TERMS[$('area').value] : (analysis?.titles?.length ? analysis.titles : (analysis?.keywords || []).slice(0, 3));
  }
  return {
    queries, keywords: analysis?.keywords || [], region: $('region').value, days: +$('days').value,
    location: $('location').value.trim(), workMode: $('workMode').value, fewApplicants: $('few').checked,
    includeUnconfirmed: $('unconfirmed').checked, seniority: $('seniority').value, area: $('area').value,
    sources: [...document.querySelectorAll('#sources input:checked')].map((i) => i.value),
  };
}
function setFilters(f) {
  if (f.queries) $('queries').value = f.queries.join(', ');
  if (f.region) $('region').value = f.region;
  if (f.days !== undefined) $('days').value = String(f.days);
  if (f.location !== undefined) $('location').value = f.location;
  if (f.workMode) $('workMode').value = f.workMode;
  if (f.remote === true && !f.workMode) $('workMode').value = 'remote';
  if (f.fewApplicants !== undefined) $('few').checked = !!f.fewApplicants;
  if (f.includeUnconfirmed !== undefined) $('unconfirmed').checked = !!f.includeUnconfirmed;
  if (f.seniority !== undefined) $('seniority').value = f.seniority;
  if (f.area !== undefined) $('area').value = f.area;
  if (f.sources?.length) document.querySelectorAll('#sources input').forEach((i) => (i.checked = f.sources.includes(i.value)));
}

// PDF -> texto
$('cvFile').onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  if (file.name.toLowerCase().endsWith('.pdf')) {
    if (!window.pdfjsLib) return alert('Leitor de PDF indisponível (sem internet?). Cole o texto.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let t = '';
    for (let i = 1; i <= pdf.numPages; i++) t += (await (await pdf.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + '\n';
    $('cvText').value = t;
  } else $('cvText').value = await file.text();
  analyze();
};

async function analyze() {
  const text = $('cvText').value.trim();
  if (text.length < 30) return alert('Cole ou envie o currículo primeiro.');
  $('analyze').disabled = true; $('cvResult').textContent = 'Analisando...';
  analysis = await post('/api/analyze-cv', { text });
  $('analyze').disabled = false;
  if (analysis.areas?.[0] && !$('area').value && Object.keys(AREA_TERMS).includes(analysis.areas[0])) $('area').value = analysis.areas[0];
  if (!$('queries').value && analysis.titles?.length) $('queries').value = analysis.titles.slice(0, 3).join(', ');
  if (analysis.language === 'en') $('region').value = 'world';
  const tags = (a) => (a || []).map((x) => `<span class="tag">${esc(x)}</span>`).join('');
  $('cvResult').innerHTML = `<b>Idioma:</b> ${analysis.language === 'en' ? 'Inglês' : 'Português'} ${analysis.seniority ? '· ' + esc(analysis.seniority) : ''}<br><b>Áreas:</b> ${tags(analysis.areas)}<br><b>Cargos:</b> ${tags(analysis.titles)}<br><b>Skills:</b> ${tags(analysis.keywords)}${analysis.aiError ? '<br>⚠ IA: ' + esc(analysis.aiError) : ''}`;
  save();
}
$('analyze').onclick = analyze;

async function runSearch() {
  const f = getFilters();
  if (!f.queries.length) return alert('Informe cargos/palavras-chave, escolha uma área ou analise seu currículo.');
  $('run').disabled = true; $('jobs').innerHTML = ''; $('links').innerHTML = '';
  $('status').textContent = '🔎 Procurando e conferindo modalidade de cada vaga... (pode levar até 1 minuto)';
  try {
    const r = await post('/api/search', f);
    jobs = r.jobs;
    const st = Object.entries(r.status).map(([k, v]) => `${v.ok ? '✅' : '❌'} ${k}${v.ok ? ' (' + v.raw + (v.verificadas !== undefined ? ', verificadas ' + v.verificadas : '') + ')' : ' ' + esc(v.error || '')}`).join(' · ');
    const c = r.counts || {};
    $('status').innerHTML = `<b>${jobs.length} vagas</b> — 🏠 ${c.remote || 0} remotas · 🏢 ${c.hybrid || 0} híbridas${c.unknown ? ' · ❔ ' + c.unknown + ' a confirmar' : ''}${c.onsite ? ' · 📍 ' + c.onsite + ' presenciais' : ''}<br>Cargos: ${esc(f.queries.join(', '))}<br>${st}`;
    $('links').innerHTML = '<div class="muted" style="width:100%">Buscar também (abre a busca pronta nessas plataformas):</div>' + r.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('');
    const MODE = { remote: '<span class="mode remote">🏠 Remoto</span>', hybrid: '<span class="mode hybrid">🏢 Híbrido</span>', onsite: '<span class="mode onsite">📍 Presencial</span>', unknown: '<span class="mode unknown">❔ A confirmar</span>' };
    $('jobs').innerHTML = jobs.map((j) => {
      const d = j.date ? new Date(j.date) : null;
      const ago = d && !isNaN(d) ? Math.max(0, Math.round((Date.now() - d) / 36e5)) : null;
      const when = ago === null ? '' : ago < 24 ? `há ${ago}h` : `há ${Math.round(ago / 24)}d`;
      const few = j.applicants != null ? `<span class="hot">👥 ${j.applicants} candidatos</span>` : j.fewApplicants ? '<span class="hot">🆕 recém-publicada</span>' : '';
      return `<div class="job"><div class="info"><h3>${esc(j.title)} ${few}</h3>
        <div class="meta">${MODE[j.mode] || ''}<span class="src">${esc(j.source)}</span>${esc(j.company)} · ${esc(j.location)} ${when ? '· ' + when : ''}${j.verified ? ' · ✔ descrição verificada' : ''}</div></div>
        <a class="go" href="${esc(j.url)}" target="_blank" rel="noopener">Ver vaga</a></div>`;
    }).join('') || '<p class="muted">Nenhuma vaga encontrada. Amplie o período, marque "Mostrar vagas sem modalidade confirmada" ou use os links acima.</p>';
  } catch (e) { $('status').textContent = 'Erro: ' + e.message; }
  $('run').disabled = false; save();
}
$('run').onclick = runSearch;

// Chat
$('chatToggle').onclick = () => $('chat').classList.toggle('hidden');
$('chatClose').onclick = () => $('chat').classList.add('hidden');
function addMsg(role, content) {
  messages.push({ role, content });
  const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = content;
  $('chatLog').appendChild(d); $('chatLog').scrollTop = 1e9;
}
$('chatForm').onsubmit = async (e) => {
  e.preventDefault();
  const t = $('chatInput').value.trim(); if (!t) return;
  $('chatInput').value = ''; addMsg('user', t);
  const r = await post('/api/chat', { messages, cvText: $('cvText').value, filters: getFilters(true), analysis, jobs });
  addMsg('assistant', r.reply || '...');
  if (r.filters && Object.keys(r.filters).length) setFilters(r.filters);
  if (r.run) runSearch();
};

fetch('/api/info').then((r) => r.json()).then((i) => {
  $('aiBadge').textContent = i.ai ? '🟢 IA: ' + i.model : '🟡 IA modo local';
  $('aiBadge').classList.toggle('on', i.ai);
  $('sources').innerHTML = i.sources.map((s) => `<label><input type="checkbox" value="${s.id}" checked> ${s.label}</label>`).join('');
  restore();
  addMsg('assistant', 'Olá! Envie seu currículo e me diga o que procura. Posso ajustar filtros e rodar a busca por você.');
});
