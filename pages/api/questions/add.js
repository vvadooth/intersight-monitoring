import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, goldenTruth, password } = req.body;

  if (!question || !goldenTruth || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isPasswordValid = await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10));
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  try {
    const result = await query(
      'INSERT INTO questions (question, golden_truth) VALUES ($1, $2) RETURNING *',
      [question, goldenTruth]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add question' });
  }
}