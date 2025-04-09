// pages/api/questions/bulk-add.js
import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questions, password } = req.body;

  if (!questions || !Array.isArray(questions) || !password) {
    return res.status(400).json({ error: 'Missing fields or invalid format' });
  }

  const isPasswordValid = await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10));
  if (!isPasswordValid) return res.status(401).json({ error: 'Invalid password' });

  try {
    for (const q of questions) {
      await query('INSERT INTO questions (question, golden_truth) VALUES ($1, $2)', [q.question, q.goldenTruth]);
    }
    res.status(200).json({ message: 'Questions added' });
  } catch (error) {
    res.status(500).json({ error: 'Bulk insert failed' });
  }
}
