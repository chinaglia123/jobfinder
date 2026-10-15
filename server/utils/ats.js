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
      return (d.jobs || []).map((j) => {
        const desc = text(j.content);
        const location = j.location?.name || '';
        return {
          url: j.absolute_url, title: j.title, company: j.company_name, location,
          mode: classifyMode(`${j.title} | ${location}`, desc), desc,
          tags: (j.departments || []).map((x) => x.name).filter(Boolean),
          date: iso(j.first_published || j.updated_at),
        };
      });
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

/** Reconhece o link de carreiras colado pelo usuário. Ex: https://jobs.lever.co/empresa */
export function parseCompanyUrl(input) {
  const s = (input || '').trim();
  const patterns = [
    ['greenhouse', /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i],
    ['greenhouse', /boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i],
    ['lever', /jobs\.(?:eu\.)?lever\.co\/([\w.-]+)/i],
    ['ashby', /jobs\.ashbyhq\.com\/([\w.%-]+)/i],
  ];
  for (const [ats, re] of patterns) {
    const m = s.match(re);
    if (m) return { ats, slug: decodeURIComponent(m[1]) };
  }
  return null;
}
