// Conectores de quadros de vagas indexados em segundo plano:
// sites de carreira das empresas (Greenhouse, Lever, Ashby) e agregadores que publicam o feed inteiro.
import { get, strip, classifyMode } from './search';

/** Desfaz HTML "escapado" (ex: &lt;p&gt;) antes de remover as tags. */
export const decode = (s) => (s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const text = (html) => strip(decode(html)).slice(0, 8000);
const iso = (v) => {
  if (v == null || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const modeFromWorkplace = (w) => {
  const t = (w || '').toString().toLowerCase().replace(/[^a-z]/g, '');
  return t === 'remote' ? 'remote' : t === 'hybrid' ? 'hybrid' : t === 'onsite' ? 'onsite' : null;
};

export const ATS = {
  greenhouse: {
    label: 'Greenhouse',
    async fetch(slug) {
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      const jobs = (d.jobs || []).map((j) => {
        const desc = text(j.content);
        const location = j.location?.name || '';
        return {
          url: j.absolute_url, title: j.title, company: j.company_name, location,
          mode: classifyMode(`${j.title} | ${location}`, desc), desc,
          tags: (j.departments || []).map((x) => x.name).filter(Boolean),
          date: iso(j.first_published || j.updated_at),
        };
      });
      jobs.boardName = d.jobs?.[0]?.company_name || null;
      return jobs;
    },
  },
  lever: {
    label: 'Lever',
    async fetch(slug) {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      return (Array.isArray(d) ? d : []).map((j) => {
        const desc = text([j.openingPlain, j.descriptionPlain, j.descriptionBodyPlain, j.additionalPlain].filter(Boolean).join('\n'));
        const location = j.categories?.allLocations?.join(' / ') || j.categories?.location || '';
        return {
          url: j.hostedUrl, title: j.text, company: null, location,
          mode: modeFromWorkplace(j.workplaceType) || classifyMode(`${j.text} | ${location} | ${j.categories?.commitment || ''}`, desc), desc,
          tags: [j.categories?.department, j.categories?.team, j.categories?.commitment].filter(Boolean),
          date: iso(j.createdAt),
        };
      });
    },
  },
  ashby: {
    label: 'Ashby',
    async fetch(slug) {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      return (d.jobs || []).filter((j) => j.isListed !== false).map((j) => {
        const desc = text(j.descriptionPlain || j.descriptionHtml);
        const location = [j.location, ...(j.secondaryLocations || []).map((s) => s.location)].filter(Boolean).join(' / ');
        return {
          url: j.jobUrl, title: j.title, company: null, location,
          mode: modeFromWorkplace(j.workplaceType) || (j.isRemote ? 'remote' : classifyMode(`${j.title} | ${location}`, desc)), desc,
          tags: [j.department, j.team, j.employmentType].filter(Boolean),
          date: iso(j.publishedAt),
        };
      });
    },
  },
  workable: {
    label: 'Workable',
    async fetch(slug) {
      const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`);
      const jobs = (d.jobs || []).map((j) => {
        const desc = text(j.description);
        const location = [j.city, j.state, j.country].filter(Boolean).join(', ') || (j.locations || []).map((l) => [l.city, l.country].filter(Boolean).join(', ')).join(' / ');
        return {
          url: j.url || j.shortlink, title: j.title, company: d.name || null, location: j.telecommuting ? `Remote · ${location}` : location,
          mode: j.telecommuting ? 'remote' : classifyMode(`${j.title} | ${location}`, desc), desc,
          tags: [j.department, j.employment_type, j.function].filter(Boolean),
          date: iso(j.published_on || j.created_at),
        };
      });
      jobs.boardName = d.name || null;
      return jobs;
    },
  },
  smartrecruiters: {
    label: 'SmartRecruiters',
    // Empresas grandes têm milhares de vagas no mundo: busca só as do Brasil (o filtro é da própria API)
    async fetch(slug) {
      const out = [];
      let boardName = null;
      for (let offset = 0; offset < 500; offset += 100) {
        const d = await get(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}&country=br`);
        for (const j of d.content || []) {
          boardName ||= j.company?.name || null;
          const loc = j.location || {};
          out.push({
            url: `https://jobs.smartrecruiters.com/${encodeURIComponent(j.company?.identifier || slug)}/${j.id}`,
            title: j.name, company: j.company?.name || null,
            location: loc.fullLocation || [loc.city, loc.country].filter(Boolean).join(', '),
            mode: loc.remote ? 'remote' : loc.hybrid ? 'hybrid' : classifyMode(j.name),
            desc: '', tags: [j.department?.label, j.typeOfEmployment?.label, j.experienceLevel?.label].filter(Boolean),
            date: iso(j.releasedDate),
          });
        }
        if ((d.content || []).length < 100) break;
      }
      out.boardName = boardName;
      return out;
    },
  },
  recruitee: {
    label: 'Recruitee',
    async fetch(slug) {
      const d = await get(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`);
      const jobs = (d.offers || []).map((j) => {
        const desc = text(`${j.description || ''} ${j.requirements || ''}`);
        return {
          url: j.careers_url, title: j.title, company: j.company_name || null,
          location: j.remote ? `Remote · ${j.location || j.country || ''}` : j.location || [j.city, j.country].filter(Boolean).join(', '),
          mode: j.remote ? 'remote' : j.hybrid ? 'hybrid' : j.on_site ? 'onsite' : classifyMode(j.title, desc), desc,
          tags: [j.department, j.employment_type_code].filter(Boolean),
          date: iso(j.published_at && j.published_at.replace(' UTC', 'Z').replace(' ', 'T')),
        };
      });
      jobs.boardName = d.offers?.[0]?.company_name || null;
      return jobs;
    },
  },
  feed: {
    label: 'Agregador',
    async fetch(slug) {
      return FEEDS[slug] ? FEEDS[slug]() : [];
    },
  },
};

const FEEDS = {
  async remoteok() {
    const d = await get('https://remoteok.com/api');
    return d.filter((j) => j.position).map((j) => ({
      url: j.url, title: j.position, company: j.company, location: j.location || 'Remote', mode: 'remote',
      desc: text(j.description), tags: j.tags || [], date: iso(j.date),
    }));
  },
  async weworkremotely() {
    const xml = await get('https://weworkremotely.com/remote-jobs.rss', false);
    const tag = (item, t) => ((item.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    return xml.split('<item>').slice(1).map((item) => {
      const full = decode(tag(item, 'title'));
      const i = full.indexOf(':');
      return {
        url: tag(item, 'link'), title: i > 0 ? full.slice(i + 1).trim() : full, company: i > 0 ? full.slice(0, i).trim() : '',
        location: tag(item, 'region') || 'Remote', mode: 'remote', desc: text(tag(item, 'description')),
        tags: [tag(item, 'category')].filter(Boolean), date: iso(tag(item, 'pubDate')),
      };
    });
  },
  async workingnomads() {
    const d = await get('https://www.workingnomads.com/api/exposed_jobs/');
    return (Array.isArray(d) ? d : []).map((j) => ({
      url: j.url, title: j.title, company: j.company_name, location: j.location || 'Remote', mode: 'remote',
      desc: text(j.description), tags: [j.category_name, ...String(j.tags || '').split(',')].map((s) => (s || '').trim()).filter(Boolean),
      date: iso(j.pub_date),
    }));
  },
};

/** Reconhece o link de carreiras (colado pelo usuário ou achado numa vaga). Ex: https://jobs.lever.co/empresa */
export function parseCompanyUrl(input) {
  const s = (input || '').trim();
  const patterns = [
    ['greenhouse', /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i],
    ['greenhouse', /boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i],
    ['lever', /jobs\.(?:eu\.)?lever\.co\/([\w.-]+)/i],
    ['ashby', /jobs\.ashbyhq\.com\/([\w.%-]+)/i],
    ['workable', /apply\.workable\.com\/(?!j\/|api\/)([\w-]+)/i],
    ['smartrecruiters', /(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/i],
    ['recruitee', /([\w-]+)\.recruitee\.com/i],
  ];
  for (const [ats, re] of patterns) {
    const m = s.match(re);
    if (m) return { ats, slug: decodeURIComponent(m[1]) };
  }
  return null;
}
