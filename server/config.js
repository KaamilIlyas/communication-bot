import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Always load .env from project root, regardless of CWD
dotenv.config({ path: path.join(rootDir, '.env') });

export const CONFIG = {
  port: parseInt(process.env.PORT || '3001', 10),
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'gemma3:4b',
  },
  whisper: {
    model: process.env.WHISPER_MODEL || 'base.en',
    pythonPath: process.env.PYTHON_PATH || (fs.existsSync(path.join(rootDir, 'venv', 'bin', 'python3')) ? path.join(rootDir, 'venv', 'bin', 'python3') : 'python3'),
    workerScript: path.join(__dirname, 'scripts', 'stt_worker.py'),
  },
  piper: {
    binaryPath: path.join(rootDir, 'venv', 'bin', 'piper'),
    modelsDir: path.join(rootDir, 'models', 'piper'),
    defaultVoice: 'af_heart',
    availableVoices: [
      { id: 'af_heart', name: 'Heart (Warm & Natural)', gender: 'Female' },
      { id: 'am_adam', name: 'Adam (Conversational)', gender: 'Male' },
      { id: 'af_bella', name: 'Bella (Expressive)', gender: 'Female' },
      { id: 'bm_george', name: 'George (British)', gender: 'Male' },
      { id: 'bf_emma', name: 'Emma (British)', gender: 'Female' },
      { id: 'af_sarah', name: 'Sarah (Studio Voice)', gender: 'Female' },
      { id: 'am_michael', name: 'Michael (Deep Voice)', gender: 'Male' }
    ]
  },
  // OpenRouter configuration – will be used when OPENROUTER_API_KEY is set
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'nex-agi/nex-n2.5-pro:free',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions'
  },
  modes: {
    casual: {
      id: 'casual',
      name: 'Casual Talk',
      icon: '💬',
      description: 'Relaxed, natural, and fun English conversation partner.'
    },
    interview: {
      id: 'interview',
      name: 'Job Interview',
      icon: '💼',
      description: 'Professional technical & behavioral mock interview simulator.',
      defaultPreset: 'Full-Stack MERN Developer',
      presets: [
        { id: 'mern', role: 'Full-Stack MERN Developer', label: '🚀 Full-Stack MERN Developer', desc: 'React, Node, Express, MongoDB, REST/GraphQL & System Design' },
        { id: 'fyp', role: 'Final Year Project (FYP) & Portfolio Defense', label: '🎓 Final Year Project (FYP) Defense', desc: 'Deep dive into your project architecture, DB choices & technical challenges' },
        { id: 'frontend', role: 'Frontend React / Next.js Engineer', label: '⚛️ Frontend React & UI Engineer', desc: 'React hooks, lifecycle, Virtual DOM, state management & performance' },
        { id: 'backend', role: 'Backend Node.js & Database Engineer', label: '🛠️ Backend (Node, Express, MongoDB)', desc: 'Event loop, middleware, MongoDB aggregation, indexing, caching & auth' },
        { id: 'custom', role: 'Custom Role', label: '✏️ Custom Target Job Role', desc: 'Type any custom job role or target technology' }
      ]
    },
    ielts: {
      id: 'ielts',
      name: 'IELTS Speaking',
      icon: '🎓',
      description: 'Official IELTS / TOEFL Speaking Exam simulator with Band score feedback.',
      defaultPreset: 'Full IELTS Speaking Test (Parts 1-3)',
      presets: [
        { id: 'full', scenario: 'Full IELTS Speaking Test (Parts 1-3)', label: '📋 Full IELTS Exam (Parts 1, 2, 3)', desc: 'Complete 3-part exam simulation with final Band score evaluation' },
        { id: 'part1', scenario: 'Part 1: Introduction & Everyday Topics', label: '🗣️ Part 1: General Q&A (4-5 mins)', desc: 'Hometown, work/study, hobbies, leisure, daily routines' },
        { id: 'part2', scenario: 'Part 2: Cue Card Long Turn Task', label: '⏱️ Part 2: Cue Card (1 min prep, 2 min speech)', desc: 'Speak for 2 uninterrupted minutes on a specific prompt card' },
        { id: 'part3', scenario: 'Part 3: In-Depth Abstract Discussion', label: '💡 Part 3: Analytical Discussion', desc: 'Two-way debate on societal, technological & global issues' }
      ]
    },
    workplace: {
      id: 'workplace',
      name: 'Workplace & Negotiation',
      icon: '🏢',
      description: 'Professional business English, executive pitches, and negotiation practice.',
      defaultPreset: 'Salary & Promotion Negotiation',
      presets: [
        { id: 'salary', scenario: 'Salary & Promotion Negotiation', label: '💰 Salary & Promotion Negotiation', desc: 'Make your case with accomplishments, handle pushback gracefully' },
        { id: 'pitch', scenario: 'Executive & Client Presentation', label: '📊 Client & Stakeholder Pitch', desc: 'Pitch a technical solution, answer sharp executive questions' },
        { id: 'standup', scenario: 'Agile Sprint Standup & Demo', label: '⏱️ Agile Sprint Standup & Demo', desc: 'Deliver concise updates, report blockers, and demo new features' },
        { id: 'conflict', scenario: 'Conflict Resolution & Deadline Pushback', label: '🤝 Difficult Conversations & Pushback', desc: 'Negotiate unrealistic deadlines and resolve team disagreements' }
      ]
    },
    debate: {
      id: 'debate',
      name: 'AI Debate Partner',
      icon: '⚔️',
      description: 'Challenging adversarial debate partner to sharpen quick-thinking and rhetoric.',
      defaultPreset: 'AI & Automation vs Human Jobs',
      presets: [
        { id: 'ai_jobs', scenario: 'AI & Automation vs Human Software Engineers', label: '🤖 AI vs Human Software Engineers', desc: 'Will AI replace software developers or amplify human creativity?' },
        { id: 'remote', scenario: 'Remote Work vs Return to Office', label: '🏡 Remote Work vs In-Office Culture', desc: 'Productivity, collaboration, mental health, and company loyalty' },
        { id: 'monolith', scenario: 'Microservices vs Monolithic Architecture', label: '🏗️ Microservices vs Monoliths', desc: 'Scalability vs operational complexity and developer velocity' },
        { id: 'social', scenario: 'Social Media Impact on Human Attention', label: '📱 Social Media: Boon or Harm?', desc: 'Information democratization vs cognitive focus and mental health' }
      ]
    }
  },
  getSystemPrompt({ mode = 'casual', role = 'Full-Stack MERN Developer', scenario = '' } = {}) {
    const baseConstraint = '\n4. Output ONLY your direct spoken dialogue. NEVER output internal thoughts, "thinking process", planning steps, or meta-commentary.';

    if (mode === 'interview') {
      return `You are a Senior Engineering Lead conducting a professional, realistic spoken mock interview for a "${role}" position.
Rules:
1. Progressive Interview Flow:
   - Ask about their Final Year Project (FYP) and architecture decisions.
   - Ask targeted technical questions on ${role} (e.g. React lifecycle/hooks, Node.js event loop, Express middleware, MongoDB indexing/aggregation, REST APIs).
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
   - In Part 1: Ask 2-3 friendly warm-up questions about general life/work/studies.
   - In Part 2: Deliver a clear Cue Card topic (Describe a person/event/place) with 3 bullet points to cover, and tell candidate to begin speaking.
   - In Part 3: Ask analytical, abstract "Why" and "How" questions connected to the Part 2 topic.
   - At the conclusion of the test or when requested, provide an encouraging IELTS Band Score estimate (Band 5.0 - 9.0) with brief feedback on Fluency, Lexical Resource, Grammar, and Pronunciation.
3. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
    }

    if (mode === 'workplace') {
      const topic = scenario || 'Salary & Promotion Negotiation';
      return `You are an executive corporate coach and hiring director roleplaying a "${topic}" workplace scenario.
Rules:
1. Scenario Roleplay:
   - Act as the manager/client/executive in this scenario with realistic corporate nuance, polite skepticism, and business standards.
   - React dynamically to the user's points (e.g. asking for metrics during salary reviews, questioning timeline in sprint standups, negotiating trade-offs).
   - Keep each spoken turn short and punchy (1 to 2 spoken sentences max) to simulate a real meeting or phone call.
2. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
    }

    if (mode === 'debate') {
      const topic = scenario || 'AI & Automation vs Human Software Engineers';
      return `You are an articulate, sharp, and respectful Oxford-style debate opponent on the topic: "${topic}".
Rules:
1. Debate Rules:
   - Always take the OPPOSING stance against the user's point of view to challenge their critical thinking and rhetoric.
   - Deliver one compelling, well-reasoned counter-argument in 1 to 2 spoken sentences, then prompt the user to defend their point.
   - Keep tone respectful, intellectually stimulating, and energetic.
2. No markdown asterisks, emojis, or bullet points in the spoken text.${baseConstraint}`;
    }

    return `You are an extraordinary, warm, charismatic, and genuinely fun English conversational partner.
Rules:
1. Speak with real human emotion, warmth, and natural reactions (e.g. "Oh, that is so cool!", "Honestly, I totally agree.", "Wow, tell me more!").
2. Keep your replies short, natural, and punchy (1 to 2 spoken sentences) so the conversation feels like an exciting, effortless voice call.
3. Always ask an engaging, curious follow-up question or share a fun relatable thought to keep the spark going.
4. Output ONLY your direct spoken words. Never write a "thinking process", planning steps, or analysis. Never list bullet points or use asterisks/markdown. Speak naturally from the heart.`;
  }
};
