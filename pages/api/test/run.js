import { query } from '../../../lib/db';
import { getAIResponse } from '../../../lib/gradio';
import OpenAI from 'openai';
import axios from 'axios';
import base64 from 'base-64';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- GALILEO: 4o-mini local API ---
async function getGalileoResponse(message) {
  const response = await axios.post('https://intersight-ai.vercel.app/api/4o-mini-search-openai', {
    query: message,
  });
  return response.data.summary;
}

// --- IntersightAI-Team-Instance unified search ---
async function getTeamInstanceResponse(message) {
  const response = await axios.post('https://intersightai-db-frontend.vercel.app/api/unified-search-ai', {
    query: message,
    resultsLimit: 5,
    limit: 5,
    distance: 1.5,
    conversation: [{ role: 'user', content: message }],
    useGoogleSearch: true,
    useVectorSearch: true,
  });
  return response.data.aiResponse;
}

// --- BridgeIT ---
async function getBridgeITAccessToken() {
  const { CLIENT_ID, CLIENT_SECRET, TOKEN_URL } = process.env;
  const encodedValue = base64.encode(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const response = await axios.post(
    TOKEN_URL,
    'grant_type=client_credentials',
    {
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${encodedValue}`,
      },
    }
  );

  return response.data.access_token;
}

async function getBridgeITResponse(message) {
  const { AZURE_OPENAI_ENDPOINT, APP_KEY } = process.env;
  const accessToken = await getBridgeITAccessToken();

  const response = await axios.post(
    `${AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4o-mini/chat/completions`,
    {
      messages: [
        { role: 'system', content: 'You are a chatbot' },
        { role: 'user', content: message },
      ],
      user: JSON.stringify({ appkey: APP_KEY }),
      stop: ['<|im_end|>'],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': accessToken,
      },
    }
  );

  return response.data.choices[0].message.content;
}

// --- Rank Responses ---
async function rankResponses(responses, goldenTruth) {
  const prompt = `
You are an evaluator tasked with ranking multiple AI responses based on their accuracy, relevance, and completeness compared to the golden truth. Please give each response a score out of 100, following the scoring rubric below.

Be critical and fair. Responses must:
- Contain all key points mentioned in the golden truth.
- Be factually accurate and clearly worded.
- Avoid introducing incorrect or misleading information.

Responses that **omit important facts** from the golden truth — even if otherwise correct — should receive significantly lower scores. Extra details are acceptable **only if they are accurate and do not distract** from the main point.

Scoring Guidelines:
- **90 to 100**: Fully accurate, complete, and clearly worded. Covers all key points from the golden truth with no factual errors.
- **75 to 89**: Mostly accurate and well-written, but misses 1 minor detail or includes slight ambiguity.
- **50 to 74**: Partially correct, but misses one or more **important points** from the golden truth or includes distracting/unnecessary information.
- **25 to 49**: Limited correctness, lacks critical information, or includes factual inaccuracies.
- **0 to 24**: Mostly or completely incorrect, misleading, or irrelevant.

Your output **must match the source name exactly** as provided in the Responses section (e.g., Gradio). Do not use generic labels like "Response 1" or "Response 1 (Source: Gradio)".

Return ONLY valid JSON in the following format:
[
  {
    "source": "<exact source string from the Responses section>",
    "score": <number>,
    "explanation": "<string>"
  },
  ...
]


DO NOT include any text outside the JSON. DO NOT use markdown. DO NOT add commentary before or after.

Golden Truth: ${goldenTruth}

Responses:
${responses.map((r, i) => `Response ${i + 1} (Source: ${r.source}):\n${r.content}`).join('\n\n')}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: prompt }],
  });

  let content = response.choices[0].message.content.trim();
  content = content.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse JSON:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { questionId } = req.body;

  try {
    const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = questionResult.rows[0];

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const [
      gradioResponse,
      bridgeITResponse,
      galileoResponse,
      teamInstanceResponse
    ] = await Promise.all([
      getAIResponse(question.question),
      getBridgeITResponse(question.question),
      getGalileoResponse(question.question),
      getTeamInstanceResponse(question.question)
    ]);

    const responses = [
      { source: 'Gradio', content: gradioResponse },
      { source: 'BridgeIT', content: bridgeITResponse },
      { source: 'Galileo', content: galileoResponse },
      { source: 'IntersightAI-Team-Instance', content: teamInstanceResponse },
    ];

    const evaluations = await rankResponses(responses, question.golden_truth);

    const results = [];
    for (const evaluation of evaluations) {
      const cleanSource = evaluation.source.replace(/^Response \d+ \(Source: /, '').replace(/\)$/, '');
      const matchedResponse = responses.find(r => r.source === cleanSource);
    
      if (!matchedResponse) {
        console.error('❌ Could not find response for source:', evaluation.source);
        console.log('🔍 Available sources in responses:', responses.map(r => r.source));
        console.log('🧾 Full evaluation object:', evaluation);
        throw new Error(`No matching response found for source: ${evaluation.source}`);
      }
    
      const result = await query(
        'INSERT INTO test_results (question_id, ai_response, score, explanation, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          questionId,
          matchedResponse.content,
          evaluation.score,
          evaluation.explanation,
          cleanSource,
        ]
      );
    
      results.push(result.rows[0]);
    }
    

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to run test' });
  }
}