import { Client } from '@gradio/client';

export async function getAIResponse(message) {
  const client = await Client.connect('https://7860-01jkvmp1wvzjd8xenx9xxv1n0h.cloudspaces.litng.ai/');
  const result = await client.predict('/chat', { message });
  return result.data;
}