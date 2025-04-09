import { query } from '../../../lib/db';
import { getAIResponse } from '../../../lib/gradio';
import { evaluateResponse } from '../../../lib/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const questionsResult = await query('SELECT * FROM questions');
    const questions = questionsResult.rows;

    const results = [];
    for (const question of questions) {
      const aiResponse = await getAIResponse(question.question);
      const evaluation = await evaluateResponse(aiResponse, question.golden_truth);

      const result = await query(
        'INSERT INTO test_results (question_id, ai_response, score, explanation) VALUES ($1, $2, $3, $4) RETURNING *',
        [question.id, aiResponse, evaluation.score, evaluation.explanation]
      );
      results.push(result.rows[0]);
    }

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to run tests' });
  }
}