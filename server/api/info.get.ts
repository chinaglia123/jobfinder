import { SOURCES } from '../utils/search';
import { AI_PROVIDERS } from '../utils/ai';
import { AI_PER_DAY } from '../utils/auth';

export default defineEventHandler((event) => {
  const groq = !!process.env.GROQ_API_KEY;
  const gemini = !!process.env.GEMINI_API_KEY;
  const openrouter = !!process.env.OPENROUTER_API_KEY;

  let activeProvider = 'local';
  let activeModel = 'Motor Heurístico Local';

  if (groq) {
    activeProvider = 'groq';
    activeModel = process.env.GROQ_MODEL || AI_PROVIDERS.groq.models[0];
  } else if (gemini) {
    activeProvider = 'gemini';
    activeModel = process.env.GEMINI_MODEL || AI_PROVIDERS.gemini.models[0];
  } else if (openrouter) {
    activeProvider = 'openrouter';
    activeModel = process.env.OPENROUTER_MODEL || AI_PROVIDERS.openrouter.models[0];
  }

  return {
    ai: activeProvider !== 'local',
    provider: activeProvider,
    model: activeModel,
    aiPerDay: AI_PER_DAY,
    sources: Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label, regions: s.regions }))
  };
});
