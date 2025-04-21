import { query } from '../../lib/db';
import OpenAI from 'openai';

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


Remember, never ever give "Response 1 (Source: FinAI)", source is always "FinAI"

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
    console.log('Raw OpenAI Response:', content); // Debug raw response

    // Enhanced cleaning: remove code fences, extra whitespace, and non-JSON content
    content = content
      .replace(/```json\n?|\n?```/g, '') // Remove ```json and ```
      .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '') // Remove leading/trailing newlines
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();

    console.log('Cleaned Content:', content); // Debug cleaned content

    // Attempt to parse JSON
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        throw new Error('Parsed response is not an array');
      }
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', content, parseError);
      // Fallback: return a default response to avoid crashing
      return responses.map(r => ({
        source: r.source,
        score: 0,
        explanation: 'Failed to parse OpenAI response; please try again.',
      }));
    }
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    // Fallback for API errors
    return responses.map(r => ({
      source: r.source,
      score: 0,
      explanation: 'Error contacting OpenAI API; please try again.',
    }));
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Return all questions
      const questionsResult = await query('SELECT id, question, golden_truth FROM questions ORDER BY id', []);
      return res.status(200).json(questionsResult.rows);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { questionId, aiResponse, responses } = req.body;

    // Handle all questions mode
    if (responses && Array.isArray(responses)) {
      const results = [];

      for (const { questionId, aiResponse } of responses) {
        if (!questionId || !aiResponse) {
          console.warn(`Skipping invalid entry: questionId=${questionId}, aiResponse=${aiResponse}`);
          continue;
        }

        const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
        const question = questionResult.rows[0];

        if (!question) {
          console.warn(`Question ID ${questionId} not found, skipping.`);
          continue;
        }

        const responseEntry = [{ source: 'FinAI', content: aiResponse }];
        const evaluations = await rankResponses(responseEntry, question.golden_truth);

        for (const evaluation of evaluations) {
          const cleanSource = evaluation.source;
          const matchedResponse = responseEntry.find(r => r.source === cleanSource);

          if (!matchedResponse) {
            console.error('❌ Could not find response for source:', cleanSource);
            continue; // Skip instead of throwing to continue processing
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
      }

      if (!results.length) {
        return res.status(400).json({ error: 'No valid responses provided or questions found' });
      }

      return res.status(200).json(results);
    }

    // Handle single question mode
    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    if (!aiResponse) {
      return res.status(400).json({ error: 'aiResponse is required' });
    }

    const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = questionResult.rows[0];

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const responsesSingle = [{ source: 'FinAI', content: aiResponse }];
    const evaluations = await rankResponses(responsesSingle, question.golden_truth);

    const results = [];
    for (const evaluation of evaluations) {
      const cleanSource = evaluation.source;
      const matchedResponse = responsesSingle.find(r => r.source === cleanSource);

      if (!matchedResponse) {
        console.error('❌ Could not find response for source:', cleanSource);
        continue;
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
    console.error('Handler Error:', error);
    res.status(500).json({ error: 'Failed to run evaluation' });
  }
}