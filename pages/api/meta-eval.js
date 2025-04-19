import { query } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const result = await query(`
        SELECT 
          source,
          accuracy,
          completeness,
          clarity,
          consistency,
          overall,
          summary,
          created_at
        FROM meta_source_evals
        ORDER BY created_at DESC
      `);
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('❌ Failed to fetch evaluations:', err);
      return res.status(500).json({ error: 'Failed to fetch meta evaluations' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { source } = req.body;

  if (!source) {
    return res.status(400).json({ error: 'Missing source in request body' });
  }

  try {
    const result = await query(`
      SELECT 
        tr.source,
        tr.score,
        tr.explanation,
        tr.question_id,
        q.question AS question_text,
        tr.created_at
      FROM test_results tr
      JOIN questions q ON tr.question_id = q.id
      WHERE tr.source = $1
      ORDER BY tr.created_at ASC
    `, [source]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No results found for source: ${source}` });
    }

    const rows = result.rows;

    const formatted = rows.map((r, i) =>
      `(${i + 1}) [${new Date(r.created_at).toLocaleString()}]
Question ID: ${r.question_id}
Question: ${r.question_text}
Score: ${r.score}
Explanation: ${r.explanation}`
    ).join('\n\n');

    const systemPrompt = `
      You are an unbiased expert evaluator analyzing the performance of an AI source across many questions.
      
      You will review many test results (each with a numeric score, question, explanation, and timestamp) and return:
      1. A detailed 5-paragraph evaluation in **Markdown format**.
      2. A breakdown of performance in four key categories, each scored out of 100.
      3. An overall score (also out of 100).
      
      ### Categories:
      - **Accuracy**: factual correctness across answers
      - **Completeness**: how well it covers key points
      - **Clarity**: clear, understandable wording
      - **Consistency**: similarity in quality across all questions
      
      ### Scoring Guidelines (per category and overall):
      - 90 to 100: Excellent — consistently strong performance
      - 75 to 89: Good — minor flaws
      - 50 to 74: Mixed — inconsistent or incomplete
      - 25 to 49: Poor — frequent errors or omissions
      - 0 to 24: Very Poor — mostly irrelevant or wrong
      
      ### 📑 Paragraph Guidelines

You must write **_five full paragraphs_**, each with **_approximately 8 complete sentences_**. Your output must be formatted using **valid Markdown**, and each paragraph should begin with a clearly marked bold header (e.g., ** 1. General Evaluation** ).

---

#### ✍️ Structure & Content

For **Paragraphs 1 through 4**, you must include:

- Between **6 to 10 detailed examples**
- Each example must contain:
  - 📅 **Date** (e.g., _March 24, 2025_)
  - 🎯 **Score** (e.g., _Score: 87_)
  - 🧠 **Observation** (e.g., _"Demonstrated improved clarity in policy-related reasoning."_)

✅ **Example Format** (use consistently):
> On **March 24, 2025**, the model scored **87** for correctly identifying jurisdictional implications in a legal question, showing improved understanding of nuanced case law.

---

#### 🧠 Paragraph Descriptions

1. **General Evaluation**  
   - Identify high-level patterns of strengths and weaknesses.
   - Use 6 to 10 examples to demonstrate repeated behavior across different contexts.

2. **Improvement Over Time**  
- Use 6 to 10 examples
   - Focus on **how performance changed over time**.
   - Each example must highlight:
     - 🔍 **What improved**  
     - 🛠️ **How it improved**  
     - 🤔 **Why it matters**  
   - Example:  
     > On _April 1, 2025_, the model scored **92**, up from **68** on March 20. It began citing source evidence in ethical policy questions, demonstrating better structured reasoning.

3. **Areas for Improvement**  
- Use 6 to 10 examples
   - Focus on recurring errors or misconceptions.
   - Use examples to show **where** and **why** the model failed to meet expectations.

4. **Common Error Patterns**  
- Use 6 to 10 examples
   - Analyze **trends in the types of mistakes**.
   - Identify frequent problem categories (e.g., medical ambiguity, numerical logic, ethical gaps).
   - Use examples to support your pattern recognition.

5. **Final Recommendation**  
   - Conclude your evaluation with a well-reasoned judgment.
   - Reflect on the source and itss overall trustworthiness, reliability, and suitability.
   - This paragraph **does not require any examples**.

---

📌 **Formatting Notes*
- Use **bold headings** for each paragraph title (** 1. General Evaluation ** , etc.).
- Maintain consistent spacing, paragraph breaks, and structure.
- Return everything as a **Markdown-formatted string** inside the summary field.


      ### Format of your final output:
      Return only this JSON — no extra prose, markdown fences, or commentary:
      
      {
        "source": "<source name>",
        "accuracy": <int>,
        "completeness": <int>,
        "clarity": <int>,
        "consistency": <int>,
        "overall": <int>,
        "summary": "<the full 5-paragraph Markdown-formatted evaluation goes here>"
      }
      `.trim();

    const userPrompt = `
Source: ${source}

Evaluation Records:
${formatted}
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/```json|```/g, '').trim();
    
    let parsed;
    try {
      // Extract first balanced JSON object using regex
      const jsonMatch = raw.match(/{[\s\S]*}/);
      if (!jsonMatch) throw new Error('No valid JSON object found in raw response.');
    
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('❌ Failed to parse JSON from OpenAI:', raw);
      throw new Error('Invalid JSON from OpenAI');
    }    

    const {
      accuracy,
      completeness,
      clarity,
      consistency,
      overall,
      summary,
    } = parsed;

    await query(
      `INSERT INTO meta_source_evals 
   (source, accuracy, completeness, clarity, consistency, overall, summary)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [source, accuracy, completeness, clarity, consistency, overall, summary]
    );

    res.status(200).json({ status: 'Evaluation complete', source });
  } catch (error) {
    console.error('Meta evaluation failed:', error);
    res.status(500).json({ error: 'Meta evaluation failed' });
  }
}
