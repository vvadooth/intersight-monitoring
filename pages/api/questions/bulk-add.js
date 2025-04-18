import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getEmbedding(text) {
  const resp = await openai.embeddings.create({
    input: text,
    model: 'text-embedding-3-small',
  });
  return resp.data[0].embedding;
}

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
      const questionEmbedding = await getEmbedding(q.question);
      const truthEmbedding = await getEmbedding(q.goldenTruth);

      await query(
        'INSERT INTO questions (question, golden_truth, question_embedding, golden_truth_embedding) VALUES ($1, $2, $3, $4)',
        [q.question, q.goldenTruth, JSON.stringify(questionEmbedding), JSON.stringify(truthEmbedding)]
      );
    }
    res.status(200).json({ message: 'Questions added' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bulk insert failed' });
  }
}
