import { updateEnvVariable } from './envService.js';

// Skip non-conversational, agentic-only, or thinking/reasoning models
const SKIP_PATTERNS = [
  'nemotron', 'thinkingmachines', 'inkling', 'content-safety', 'code', 'sante',
  'fin', 'music', 'lyria', 'clip', 'omni', 'reasoning', 'embedding', 'thought', 'r1'
];

// Preferred models for fast, direct conversational voice AI (clean direct spoken dialogue)
const PREFERRED_MODELS = [
  'nex-agi/nex-n2.5-pro:free',
  'nex-agi/nex-n2.5-mini:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openrouter/free'
];

let cachedFreeModels = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

/**
 * Fetches all free conversational models from OpenRouter API
 */
export async function fetchFreeModels(apiKey, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedFreeModels && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedFreeModels;
  }

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.status);
    throw new Error(`OpenRouter models API returned ${res.status}: ${errText}`);
  }

  const { data: models } = await res.json();

  const free = (models || [])
    .filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
    .filter(m => !SKIP_PATTERNS.some(p => m.id.toLowerCase().includes(p)))
    .map(m => ({ id: m.id, name: m.name, ctx: m.context_length || 0 }))
    .sort((a, b) => b.ctx - a.ctx);

  cachedFreeModels = free;
  lastCacheTime = now;
  return free;
}

/**
 * Quick validation check to ensure a free model is responsive and does NOT output thinking process
 */
async function testModelViability(modelId, apiKey) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://english-speaking-bot',
        'X-Title': 'English Speaking Bot'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say hello in one word.' }],
        max_tokens: 25
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = (data.choices?.[0]?.message?.content || '').toLowerCase();
      if (content.includes('thinking process') || content.includes('<think>') || content.includes('analyze user')) {
        console.log(`[OpenRouter] ⚠️ Model ${modelId} emits thinking process text. Discarding.`);
        return false;
      }
      return true;
    }
    const body = await res.text().catch(() => '');
    console.log(`[OpenRouter] Test ping failed for ${modelId} (${res.status}): ${body.slice(0, 100)}`);
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Finds the best active free model excluding any failed or deprecated models.
 * Validates with a quick test before returning and automatically persists choice to .env.
 */
export async function getBestAvailableFreeModel({ apiKey, excludedModels = [] }) {
  if (!apiKey) return null;

  console.log('[OpenRouter] 🔍 Querying OpenRouter for currently available free models...');
  const freeModels = await fetchFreeModels(apiKey, true);

  const candidates = freeModels.filter(m => !excludedModels.includes(m.id));
  if (candidates.length === 0) {
    return null;
  }

  // Sort candidates so preferred models come first
  const sortedCandidates = [...candidates].sort((a, b) => {
    const aPref = PREFERRED_MODELS.indexOf(a.id);
    const bPref = PREFERRED_MODELS.indexOf(b.id);
    if (aPref !== -1 && bPref !== -1) return aPref - bPref;
    if (aPref !== -1) return -1;
    if (bPref !== -1) return 1;
    return b.ctx - a.ctx;
  });

  // Verify candidate viability
  let viableModel = null;
  for (const candidate of sortedCandidates.slice(0, 5)) {
    console.log(`[OpenRouter] 🔎 Checking candidate free model: ${candidate.id}...`);
    const isViable = await testModelViability(candidate.id, apiKey);
    if (isViable) {
      viableModel = candidate.id;
      console.log(`[OpenRouter] ✨ Found active & responsive free model: ${viableModel}`);
      break;
    }
  }

  // Fallback to top candidate if ping failed due to transient timeout
  const finalModel = viableModel || sortedCandidates[0]?.id;

  if (finalModel) {
    updateEnvVariable('OPENROUTER_MODEL', finalModel);
  }

  return finalModel;
}
