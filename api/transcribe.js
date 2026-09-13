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

  const groqApiKey = process.env.GROQ_API_KEY || req.headers['x-groq-key'];
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!groqApiKey && !openaiApiKey) {
    return res.status(400).json({
      error: 'Missing GROQ_API_KEY. Please add GROQ_API_KEY to your Vercel project environment variables (free at https://console.groq.com/keys).'
    });
  }

  try {
    const { audio, format = 'wav' } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    const blob = new Blob([audioBuffer], { type: `audio/${format}` });
    const formData = new FormData();
    formData.append('file', blob, `audio.${format}`);

    if (groqApiKey) {
      // Groq Cloud Whisper API (Ultra fast ~200ms latency, 100% free tier)
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: formData
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text().catch(() => groqRes.status);
        console.error('[Groq STT] Error:', errText);
        return res.status(groqRes.status).json({ error: `Groq Whisper failed: ${errText}` });
      }

      const data = await groqRes.json();
      return res.status(200).json({ text: (data.text || '').trim() });
    } else {
      // OpenAI Whisper fallback
      formData.append('model', 'whisper-1');
      const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });

      if (!oaiRes.ok) {
        const errText = await oaiRes.text().catch(() => oaiRes.status);
        return res.status(oaiRes.status).json({ error: `OpenAI Whisper failed: ${errText}` });
      }

      const data = await oaiRes.json();
      return res.status(200).json({ text: (data.text || '').trim() });
    }
  } catch (err) {
    console.error('[Transcribe API] Error:', err);
    return res.status(500).json({ error: err.message || 'Transcription error' });
  }
}
