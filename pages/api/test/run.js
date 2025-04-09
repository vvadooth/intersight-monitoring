import { query } from '../../../lib/db';
import { getAIResponse } from '../../../lib/gradio';
import { evaluateResponse } from '../../../lib/openai';

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

    const aiResponse = await getAIResponse(question.question);
    const evaluation = await evaluateResponse(aiResponse, question.golden_truth);

    const result = await query(
      'INSERT INTO test_results (question_id, ai_response, score, explanation) VALUES ($1, $2, $3, $4) RETURNING *',
      [questionId, aiResponse, evaluation.score, evaluation.explanation]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to run test' });
  }
}