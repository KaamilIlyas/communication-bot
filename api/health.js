export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'ok',
    mode: 'vercel-serverless',
    stt: Boolean(process.env.GROQ_API_KEY) ? 'groq-whisper' : 'not-configured',
    llm: Boolean(process.env.OPENROUTER_API_KEY) ? 'openrouter' : (Boolean(process.env.GROQ_API_KEY) ? 'groq-llama' : 'not-configured')
  });
}
