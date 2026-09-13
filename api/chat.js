function getSystemPrompt({ mode = 'casual', role = 'Full-Stack MERN Developer', scenario = '' } = {}) {
  const baseConstraint = '\n4. Output ONLY your direct spoken dialogue. NEVER output internal thoughts, "thinking process", planning steps, or meta-commentary.';

  if (mode === 'interview') {
    return `You are a Senior Engineering Lead conducting a professional, realistic spoken mock interview for a "${role}" position.
Rules:
1. Progressive Interview Flow:
   - Ask targeted technical questions on ${role} (React, Node, Express, MongoDB, REST/System Design).
   - Ask practical problem-solving & behavioral questions (STAR method).
2. Spoken Dialogue Rules:
   - Keep each turn concise, natural, and professional (1 to 2 spoken sentences max).
   - Briefly acknowledge and assess their previous answer with constructive encouragement, then ask ONE clear question at a time.
   - Never dump multiple questions, lists, or bullet points.
3. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
  }

  if (mode === 'ielts') {
    const stage = scenario || 'Full IELTS Speaking Test';
    return `You are an official, highly certified British Council / IDP IELTS Speaking Examiner conducting a "${stage}" test.
Rules:
1. Examiner Protocol:
   - Speak with clear, articulate, and professional examiner tone.
   - Keep spoken turns concise (1 to 2 spoken sentences) asking ONE clear question at a time.
   - Deliver warm, encouraging guidance with IELTS Band criteria in mind.
2. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
  }

  if (mode === 'workplace') {
    const topic = scenario || 'Salary & Promotion Negotiation';
    return `You are an executive corporate coach and hiring director roleplaying a "${topic}" workplace scenario.
Rules:
1. Scenario Roleplay:
   - Act as the manager/client/executive with realistic nuance and business standards.
   - Keep each spoken turn short and punchy (1 to 2 spoken sentences max) to simulate a real meeting or phone call.
2. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
  }

  if (mode === 'debate') {
    const topic = scenario || 'AI & Automation vs Human Software Engineers';
    return `You are an articulate, sharp, and respectful Oxford-style debate opponent on the topic: "${topic}".
Rules:
1. Always take the OPPOSING stance against the user to challenge their critical thinking.
2. Deliver one compelling counter-argument in 1 to 2 spoken sentences, then prompt the user to defend their point.
3. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
  }

  return `You are an extraordinary, warm, charismatic, and genuinely fun English conversational partner.
Rules:
1. Speak with real human emotion, warmth, and natural reactions (e.g. "Oh, that is so cool!", "Honestly, I totally agree.", "Wow, tell me more!").
2. Keep your replies short, natural, and punchy (1 to 2 spoken sentences) so the conversation feels like an exciting, effortless voice call.
3. Always ask an engaging, curious follow-up question or share a fun relatable thought to keep the spark going.
4. Output ONLY your direct spoken words. Never write a "thinking process", planning steps, or analysis. Never list bullet points or use asterisks/markdown. Speak naturally from the heart.`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    messages = [],
    mode = 'casual',
    role = 'Full-Stack MERN Developer',
    scenario = '',
    customApiKey = ''
  } = req.body || {};

  const openrouterKey = customApiKey || process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!openrouterKey && !groqKey) {
    return res.status(400).json({
      error: 'Missing API key. Please add OPENROUTER_API_KEY or GROQ_API_KEY to your environment variables.'
    });
  }

  const systemPrompt = getSystemPrompt({ mode, role, scenario });
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  let model = process.env.OPENROUTER_MODEL || 'nex-agi/nex-n2.5-pro:free';
  let authHeader = `Bearer ${openrouterKey}`;

  if (!openrouterKey && groqKey) {
    // If no OpenRouter key, use Groq's high-speed free Llama 3.3 model!
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    model = 'llama-3.3-70b-versatile';
    authHeader = `Bearer ${groqKey}`;
  }

  try {
    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'HTTP-Referer': 'https://fluentai-voice-bot.vercel.app',
        'X-Title': 'FluentAI Spoken English Bot'
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => upstreamRes.status);
      return res.status(upstreamRes.status).json({
        error: `LLM request failed (${upstreamRes.status}): ${errText}`
      });
    }

    // Stream SSE back to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let isThinking = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }

          try {
            const parsed = JSON.parse(raw);
            const token = parsed.choices?.[0]?.delta?.content || '';

            if (!token) continue;

            // Filter chain-of-thought tokens
            if (token.includes('<think>')) {
              isThinking = true;
              continue;
            }
            if (token.includes('</think>')) {
              isThinking = false;
              continue;
            }
            if (isThinking) continue;

            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          } catch (e) {
            // pass non-json line
          }
        }
      }
    }

    res.end();
  } catch (err) {
    console.error('[Chat API] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'LLM generation failed' });
    } else {
      res.end();
    }
  }
}
