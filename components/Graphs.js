import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Graphs({ questions }) {
  const [overallData, setOverallData] = useState(null);
  const [questionData, setQuestionData] = useState({});

  // Fetch test results and prepare data for graphs
  useEffect(() => {
    const fetchData = async () => {
      const allResults = [];
      const questionResults = {};

      // Fetch results for each question
      for (const question of questions) {
        const res = await fetch(`/api/results/${question.id}`);
        const results = await res.json();
        allResults.push(...results.map((r) => ({ ...r, questionId: question.id })));
        questionResults[question.id] = results;
      }

      // Prepare overall performance data (average score over time)
      const dates = [...new Set(allResults.map((r) => new Date(r.created_at).toLocaleDateString()))].sort();
      const overallScores = dates.map((date) => {
        const resultsOnDate = allResults.filter(
          (r) => new Date(r.created_at).toLocaleDateString() === date
        );
        const avgScore =
          resultsOnDate.length > 0
            ? resultsOnDate.reduce((sum, r) => sum + r.score, 0) / resultsOnDate.length
            : 0;
        return avgScore;
      });

      setOverallData({
        labels: dates,
        datasets: [
          {
            label: 'Average Score',
            data: overallScores,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
          },
        ],
      });

      // Prepare per-question performance data
      const questionDataTemp = {};
      for (const question of questions) {
        const results = questionResults[question.id] || [];
        const questionDates = results.map((r) => new Date(r.created_at).toLocaleDateString());
        const scores = results.map((r) => r.score);

        questionDataTemp[question.id] = {
          labels: questionDates,
          datasets: [
            {
              label: `Score for "${question.question}"`,
              data: scores,
              borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
              backgroundColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.2)`,
              fill: true,
            },
          ],
        };
      }
      setQuestionData(questionDataTemp);
    };

    if (questions.length > 0) {
      fetchData();
    }
  }, [questions]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Score (out of 100)' },
      },
      x: {
        title: { display: true, text: 'Date' },
      },
    },
  };

  return (
    <div className="space-y-8 mt-8">
      {/* Overall Performance Graph */}
      {overallData && (
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Line
              data={overallData}
              options={{
                ...chartOptions,
                plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Average Score Across All Questions' } },
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Per-Question Performance Graphs */}
      {questions.map((question) => (
        questionData[question.id] && (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle>Performance for: {question.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <Line
                data={questionData[question.id]}
                options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: `Score Over Time for "${question.question}"` } },
                }}
              />
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
}