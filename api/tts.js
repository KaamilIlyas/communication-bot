import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Voice mapping from bot persona IDs to state-of-the-art Azure Edge Neural voices
const VOICE_MAP = {
  'af_heart': 'en-US-JennyNeural',       // Warm, natural, friendly female
  'am_adam': 'en-US-GuyNeural',          // Conversational, relatable male
  'af_bella': 'en-US-AriaNeural',        // Expressive, energetic female
  'bm_george': 'en-GB-RyanNeural',       // British RP male
  'bf_emma': 'en-GB-SoniaNeural',        // British BBC female
  'af_sarah': 'en-US-AvaNeural',         // Studio voice female
  'am_michael': 'en-US-ChristopherNeural' // Deep authoritative male
};

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, voice = 'af_heart', speed = 1.0 } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter.' });
    }

    // Clean text: strip markdown, bracketed annotations, thinking blocks
    const cleanedText = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/\[CORRECTION:.*?\]/gi, '')
      .replace(/[*#`_~]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanedText) {
      return res.status(400).json({ error: 'No speakable text remaining.' });
    }

    const neuralVoice = VOICE_MAP[voice] || 'en-US-JennyNeural';
    const tts = new MsEdgeTTS();
    await tts.setMetadata(neuralVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // Calculate rate percentage for msedge-tts (e.g. "+0%", "+10%", "-10%")
    const ratePercent = Math.round((Math.max(0.7, Math.min(1.5, speed)) - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const { audioStream } = tts.toStream(cleanedText, { rate: rateStr });

    const chunks = [];
    audioStream.on('data', chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const audioBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error('[API/TTS] Error generating neural audio:', err);
    return res.status(500).json({
      error: 'Failed to synthesize neural audio',
      details: err.message
    });
  }
}
