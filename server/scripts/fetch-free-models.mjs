#!/usr/bin/env node
/**
 * fetch-free-models.mjs
 * Fetches all free OpenRouter models and recommends the best one for chat.
 * Usage: node server/scripts/fetch-free-models.mjs [--apply]
 *   --apply  Automatically write the best model to .env
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
dotenv.config({ path: join(rootDir, '.env') });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set in .env');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

// Models known to be bad for conversational use (coding-only, safety, music, etc.)
const SKIP_PATTERNS = [
  'content-safety', 'code', 'sante', 'fin', 'music', 'lyria',
  'clip', 'omni', 'reasoning', 'embedding'
];

// Preferred models for fast conversational AI (checked in order, tested & working)
const PREFERRED = [
  'minimax/minimax-m3:free',             // ✅ Tested: clean, fast, 1M ctx
  'google/gemma-4-31b-it:free',          // good quality (may rate-limit)
  'google/gemma-4-26b-a4b-it:free',      // MoE = fast (may rate-limit)
  'nvidia/nemotron-3.5-lightning:free',  // fast but emits thinking text
  'nvidia/nemotron-3-super-120b-a12b:free',
];

console.log('\n🔍 Fetching free models from OpenRouter...\n');

const res = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { Authorization: `Bearer ${API_KEY}` }
});

if (!res.ok) {
  console.error('❌ OpenRouter API error:', res.status, await res.text());
  process.exit(1);
}

const { data: models } = await res.json();

const free = models
  .filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
  .filter(m => !SKIP_PATTERNS.some(p => m.id.toLowerCase().includes(p)))
  .map(m => ({ id: m.id, name: m.name, ctx: m.context_length || 0 }))
  .sort((a, b) => b.ctx - a.ctx);

console.log(`✅ Found ${free.length} free conversational models:\n`);
free.forEach((m, i) => {
  const star = PREFERRED.includes(m.id) ? ' ⭐' : '';
  console.log(`  ${String(i + 1).padStart(2)}. ${m.id}${star}`);
  console.log(`      Context: ${(m.ctx / 1000).toFixed(0)}K | ${m.name}`);
});

const best = PREFERRED.find(p => free.some(m => m.id === p)) || free[0]?.id;
console.log(`\n🏆 Recommended: ${best}\n`);

if (APPLY) {
  const envPath = join(rootDir, '.env');
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  // Remove any old commented or active OPENROUTER_MODEL lines
  envContent = envContent.replace(/^#?\s*OPENROUTER_MODEL=.*$/gm, '').trim();
  envContent += `\nOPENROUTER_MODEL=${best}\n`;
  writeFileSync(envPath, envContent);
  console.log(`✅ Applied to .env: OPENROUTER_MODEL=${best}`);
  console.log('   Restart run.sh for changes to take effect.\n');
} else {
  console.log(`Run with --apply to set this model in .env automatically.`);
}
