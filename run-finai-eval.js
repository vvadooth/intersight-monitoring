const axios = require('axios');
const readline = require('readline');

const API_URL = 'http://localhost:3000/api/run-finai-eval'; // Update if deployed
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptForResponse(question) {
  return new Promise((resolve) => {
    console.log(`\nQuestion ID: ${question.id}`);
    console.log(`Question: ${question.question}`);
    rl.question('Enter FinAI response: ', (answer) => {
      resolve(answer.trim());
    });
  });
}

async function runAllQuestions() {
  try {
    // Fetch all questions
    const response = await axios.get(API_URL);
    const questions = response.data;

    if (!questions.length) {
      console.log('No questions found in the database.');
      rl.close();
      return;
    }

    console.log(`Found ${questions.length} questions. Please provide FinAI responses for each.\n`);

    // Process each question
    for (const question of questions) {
      const aiResponse = await promptForResponse(question);
      if (!aiResponse) {
        console.log(`Skipping question ${question.id} (empty response).`);
        continue;
      }

      // Send response to API for evaluation
      try {
        const evalResponse = await axios.post(API_URL, {
          questionId: question.id,
          aiResponse,
        });

        const results = evalResponse.data;
        console.log(`\nResults for Question ID ${question.id}:`);
        results.forEach((result) => {
          console.log(`Source: ${result.source}`);
          console.log(`Score: ${result.score}`);
          console.log(`Explanation: ${result.explanation}`);
          console.log(`Response: ${result.ai_response}`);
          console.log('---');
        });
      } catch (error) {
        console.error(`Error evaluating question ${question.id}:`, error.response?.data?.error || error.message);
      }
    }

    console.log('\nAll questions processed.');
    rl.close();
  } catch (error) {
    console.error('Error fetching questions:', error.response?.data?.error || error.message);
    rl.close();
  }
}

async function runSingleQuestion(questionId, aiResponse) {
  try {
    const response = await axios.post(API_URL, {
      questionId,
      aiResponse,
    });

    const results = response.data;
    console.log(`\nResults for Question ID ${questionId}:`);
    results.forEach((result) => {
      console.log(`Source: ${result.source}`);
      console.log(`Score: ${result.score}`);
      console.log(`Explanation: ${result.explanation}`);
      console.log(`Response: ${result.ai_response}`);
      console.log('---');
    });
  } catch (error) {
    console.error(`Error evaluating question ${questionId}:`, error.response?.data?.error || error.message);
  } finally {
    rl.close();
  }
}

async function main() {
  rl.question('Run for all questions? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      await runAllQuestions();
    } else {
      rl.question('Enter questionId: ', (questionId) => {
        rl.question('Enter FinAI response: ', (aiResponse) => {
          if (!questionId || !aiResponse) {
            console.error('questionId and aiResponse are required.');
            rl.close();
            return;
          }
          runSingleQuestion(parseInt(questionId), aiResponse);
        });
      });
    }
  });
}

main();