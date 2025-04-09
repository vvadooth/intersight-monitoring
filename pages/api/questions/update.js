import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, question, goldenTruth, password } = req.body;

  if (!id || !question || !goldenTruth || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const isPasswordValid = await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10));
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  try {
    const result = await query(
      'UPDATE questions SET question = $1, golden_truth = $2 WHERE id = $3 RETURNING *',
      [question, goldenTruth, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
}
