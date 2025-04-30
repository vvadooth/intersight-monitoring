require('dotenv').config();
const crypto = require('crypto');
const { query } = require('../../lib/db');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Rank Responses ---
async function rankResponses(responses, goldenTruth) {
  const prompt = `
You are an evaluator tasked with ranking multiple AI responses based on their accuracy, relevance, and completeness compared to the golden truth. Please give each response a score out of 100, following the scoring rubric below.

Be critical and fair. Responses must:
- Contain all key points mentioned in the golden truth.
- Be factually accurate and clearly worded.
- Avoid introducing incorrect or misleading information.

Responses that **omit important facts** from the golden truth — even if otherwise correct — should receive lower scores. Extra details are acceptable **only if they are accurate and do not distract** from the main point.

Scoring Guidelines:
- **90 to 100**: Fully accurate, complete, and clearly worded. Covers all key points from the golden truth with no factual errors.
- **75 to 89**: Mostly accurate and well-written, but misses 1 minor detail or includes slight ambiguity.
- **50 to 74**: Partially correct, but misses one or more **important points** from the golden truth or includes distracting/unnecessary information.
- **25 to 49**: Limited correctness, lacks critical information, or includes factual inaccuracies.
- **0 to 24**: Mostly or completely incorrect, misleading, or irrelevant.

- Be fair and honest and a true LLM as a Judge with your evaluations.

Your output **must match the source name exactly** as provided in the Responses section (e.g., FinAI). Do not use generic labels like "Response 1" or "Response 1 (Source: FinAI)".

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

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
    });

    let content = response.choices[0].message.content || '';
    console.log('Raw OpenAI Response:', content);

    content = content
      .replace(/```json\n?|\n?```/g, '')
      .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('Cleaned Content:', content);

    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new Error('Parsed response is not an array');
      }
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', content, parseError);
      return responses.map(r => ({
        source: r.source,
        score: 0,
        explanation: 'Failed to parse OpenAI response; please try again.',
      }));
    }
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    return responses.map(r => ({
      source: r.source,
      score: 0,
      explanation: 'Error contacting OpenAI API; please try again.',
    }));
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the webhook signature
    const rawBody = Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-hub-signature'];
    const computedSignature = 'sha1=' + crypto.createHmac('sha1', process.env.CLIENT_SECRET)
      .update(rawBody)
      .digest('hex');

    if (!signature || signature !== computedSignature) {
      console.log('Signature verification failed');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const data = req.body;
    console.log('Received webhook payload:', JSON.stringify(data, null, 2));

    if (data.topic !== 'conversation.operator.replied') {
      return res.status(200).json({ status: 'ignored' });
    }

    const conversationId = data.data.item.id;
    const finResponseRaw = data.data.item.conversation_parts.conversation_parts[0].body;
    const finResponse = finResponseRaw.replace(/<p>|<\/p>/g, '');

    // Extract user_id
    let userId = 'unknown_user';
    if (data.data.item.contacts?.contacts?.[0]?.id) {
      userId = data.data.item.contacts.contacts[0].id;
    }

    // Extract the user's question (from conversation source)
    let userQuestion = '';
    if (data.data.item.source?.body) {
      userQuestion = data.data.item.source.body.replace(/<p>|<\/p>/g, '');
    }

    console.log(`Conversation ID: ${conversationId}, User ID: ${userId}, Fin Response: ${finResponse}, User Question: ${userQuestion}`);

    // Fetch all questions from the database
    const questionsResult = await query('SELECT id, question, golden_truth FROM questions ORDER BY id', []);
    const questions = questionsResult.rows;

    // Check if the user's question matches any in the database (word for word)
    const matchedQuestion = questions.find(q => q.question.trim().toLowerCase() === userQuestion.trim().toLowerCase());

    if (!matchedQuestion) {
      console.log('No matching question found in database');
      return res.status(200).json({ status: 'no_match' });
    }

    console.log(`Matched question ID: ${matchedQuestion.id}, Question: ${matchedQuestion.question}`);

    // Evaluate Fin's response
    const responses = [{ source: 'FinAI', content: finResponse }];
    const evaluations = await rankResponses(responses, matchedQuestion.golden_truth);

    const results = [];
    for (const evaluation of evaluations) {
      const cleanSource = evaluation.source;
      const matchedResponse = responses.find(r => r.source === cleanSource);

      if (!matchedResponse) {
        console.error('❌ Could not find response for source:', cleanSource);
        continue;
      }

      const result = await query(
        'INSERT INTO test_results (question_id, ai_response, score, explanation, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          matchedQuestion.id,
          matchedResponse.content,
          evaluation.score,
          evaluation.explanation,
          cleanSource,
        ]
      );

      results.push(result.rows[0]);
    }

    return res.status(200).json({ status: 'success', results });
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}