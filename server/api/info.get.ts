import { SOURCES } from '../utils/search';

export default defineEventHandler((event) => {
  const groq = !!process.env.GROQ_API_KEY;
  const gemini = !!process.env.GEMINI_API_KEY;
  const openrouter = !!process.env.OPENROUTER_API_KEY;

  let activeProvider = 'local';
  let activeModel = 'Motor Heurístico Local';

  if (groq) {
    activeProvider = 'groq';
    activeModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  } else if (gemini) {
    activeProvider = 'gemini';
    activeModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  } else if (openrouter) {
    activeProvider = 'openrouter';
    activeModel = process.env.OPENROUTER_MODEL || 'llama-3.2-3b';
  }

  return {
    ai: activeProvider !== 'local',
    provider: activeProvider,
    model: activeModel,
    sources: Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label, regions: s.regions }))
  };
});
