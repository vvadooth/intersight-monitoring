import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function evaluateResponse(aiResponse, goldenTruth) {
  const prompt = `
    You are an evaluator. While harsh, if it is correct you're going to treat it fairly. Like if the golden answer is straightforward and the answer is given but other details are given as well, that's okay. Let's give it a high score. Compare the following AI response to the golden truth answer and provide a score out of 100, along with a detailed explanation of the score. Be critical and focus on accuracy, relevance, and completeness.

    AI Response: ${aiResponse}
    Golden Truth: ${goldenTruth}

    Provide your evaluation in the following format:
    {
      "score": <number>,
      "explanation": "<detailed explanation>"
    }
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}