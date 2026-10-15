// Exporta o currículo adaptado em PDF e DOCX, no formato que sistemas de triagem (ATS) leem bem:
// uma coluna, títulos padrão, sem tabelas nem imagens, texto selecionável.
// As bibliotecas só são baixadas quando a pessoa clica em exportar.

const HEADINGS = {
  pt: { summary: 'Resumo', skills: 'Competências', experience: 'Experiência profissional', education: 'Formação', certifications: 'Cursos e certificações', languages: 'Idiomas', original: 'Currículo' },
  en: { summary: 'Summary', skills: 'Skills', experience: 'Professional experience', education: 'Education', certifications: 'Certifications', languages: 'Languages', original: 'Resume' },
};

/** Seções na ordem do documento (as vazias somem) */
function sections(cv) {
  const h = HEADINGS[cv.lang === 'en' ? 'en' : 'pt'];
  const out = [];
  if (cv.summary) out.push({ title: h.summary, paragraphs: [cv.summary] });
  if (cv.skills?.length) out.push({ title: h.skills, paragraphs: [cv.skills.join(' · ')] });
  if (cv.experience?.length) out.push({ title: h.experience, jobs: cv.experience });
  if (cv.education?.length) out.push({ title: h.education, bullets: cv.education });
  if (cv.certifications?.length) out.push({ title: h.certifications, bullets: cv.certifications });
  if (cv.languages?.length) out.push({ title: h.languages, bullets: cv.languages });
  // Versão básica (sem IA): o texto original vem inteiro depois das competências reordenadas
  if (cv.rawText && !cv.experience?.length) out.push({ title: h.original, paragraphs: cv.rawText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) });
  return out;
}

const jobLine = (e) => [e.role, e.company].filter(Boolean).join(' — ');

/** Texto simples (para colar em formulários de candidatura) */
export function cvToText(cv) {
  const lines = [cv.name, cv.headline, cv.contact].filter(Boolean);
  for (const s of sections(cv)) {
    lines.push('', s.title.toUpperCase());
    for (const p of s.paragraphs || []) lines.push(p);
    for (const b of s.bullets || []) lines.push(`• ${b}`);
    for (const e of s.jobs || []) {
      lines.push(`${jobLine(e)}${e.period ? ` (${e.period})` : ''}`);
      for (const b of e.bullets || []) lines.push(`• ${b}`);
      lines.push('');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const cvFileName = (cv, job, ext) => {
  const safe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `Curriculo-${safe(cv.name) || 'candidato'}-${safe(job?.company) || 'vaga'}.${ext}`;
};

export async function downloadPdf(cv, filename) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const vfs = (await import('pdfmake/build/vfs_fonts')).default;
  pdfMake.addVirtualFileSystem(vfs);
  const content = [
    { text: cv.name || '', style: 'name' },
    cv.headline ? { text: cv.headline, style: 'headline' } : null,
    cv.contact ? { text: cv.contact, style: 'contact' } : null,
  ].filter(Boolean);
  for (const s of sections(cv)) {
    content.push({ text: s.title.toUpperCase(), style: 'section' });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: '#9aa3b2' }], margin: [0, 0, 0, 6] });
    for (const p of s.paragraphs || []) content.push({ text: p, margin: [0, 0, 0, 4] });
    if (s.bullets?.length) content.push({ ul: s.bullets, margin: [0, 0, 0, 4] });
    for (const e of s.jobs || []) {
      content.push({ columns: [{ text: jobLine(e), bold: true }, { text: e.period || '', alignment: 'right', width: 'auto', color: '#555' }], margin: [0, 4, 0, 2] });
      if (e.bullets?.length) content.push({ ul: e.bullets, margin: [0, 0, 0, 4] });
    }
  }
  const doc = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: { title: `Currículo — ${cv.name || ''}`, author: cv.name || '' },
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#1f2430' },
    styles: {
      name: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
      headline: { fontSize: 11.5, color: '#2f5bea', margin: [0, 0, 0, 2] },
      contact: { fontSize: 9.5, color: '#555', margin: [0, 0, 0, 10] },
      section: { fontSize: 10.5, bold: true, color: '#1f2430', margin: [0, 10, 0, 3] },
    },
  };
  await pdfMake.createPdf(doc).download(filename);
}

export async function downloadDocx(cv, filename) {
  const { Document, Packer, Paragraph, TextRun, BorderStyle, TabStopType } = await import('docx');
  const children = [
    new Paragraph({ children: [new TextRun({ text: cv.name || '', bold: true, size: 36 })], spacing: { after: 40 } }),
  ];
  if (cv.headline) children.push(new Paragraph({ children: [new TextRun({ text: cv.headline, size: 23, color: '2F5BEA' })], spacing: { after: 40 } }));
  if (cv.contact) children.push(new Paragraph({ children: [new TextRun({ text: cv.contact, size: 19, color: '555555' })], spacing: { after: 160 } }));
  const heading = (t) => new Paragraph({
    children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 21 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '9AA3B2', space: 2 } },
    spacing: { before: 200, after: 80 },
  });
  const bullet = (t) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 30 } });
  for (const s of sections(cv)) {
    children.push(heading(s.title));
    for (const p of s.paragraphs || []) children.push(new Paragraph({ text: p, spacing: { after: 60 } }));
    for (const b of s.bullets || []) children.push(bullet(b));
    for (const e of s.jobs || []) {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        children: [new TextRun({ text: jobLine(e), bold: true }), new TextRun({ text: e.period ? `\t${e.period}` : '', color: '555555' })],
        spacing: { before: 80, after: 30 },
      }));
      for (const b of e.bullets || []) children.push(bullet(b));
    }
  }
  const doc = new Document({
    creator: cv.name || 'JobFinder',
    title: `Currículo — ${cv.name || ''}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
