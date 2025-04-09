import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuestionTable from '@/components/QuestionTable';
import AddQuestionDialog from '@/components/AddQuestionDialog';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Home() {
    const [questions, setQuestions] = useState([]);
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testLogs, setTestLogs] = useState([]);
    const [testContext, setTestContext] = useState('');
    const [overallGraphData, setOverallGraphData] = useState(null);
    const logRef = useRef(null);

    const fetchQuestions = async () => {
        const res = await fetch('/api/questions/list');
        const data = await res.json();
        setQuestions(data);
    };

    const fetchOverallGraph = async () => {
        const allResults = [];
        for (const question of questions) {
            const res = await fetch(`/api/results/${question.id}`);
            const results = await res.json();
            allResults.push(...results);
        }

        const dates = [...new Set(allResults.map((r) => new Date(r.created_at).toLocaleDateString()))].sort();
        const overallScores = dates.map((date) => {
            const resultsOnDate = allResults.filter((r) => new Date(r.created_at).toLocaleDateString() === date);
            const avgScore =
                resultsOnDate.length > 0
                    ? resultsOnDate.reduce((sum, r) => sum + r.score, 0) / resultsOnDate.length
                    : 0;
            return avgScore;
        });

        setOverallGraphData({
            labels: dates,
            datasets: [
                {
                    label: 'Average Score Across All Questions',
                    data: overallScores,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                },
            ],
        });
    };

    const handleRunAllTests = async () => {
        if (isTesting) return;
        setIsTesting(true);
        setTestContext('Running all tests...');
        setTestLogs(['🧪 Starting full test suite...']);
    
        try {
            for (let index = 0; index < questions.length; index++) {
                const q = questions[index];
                const logTime = new Date().toLocaleTimeString();
                setTestLogs((prev) => [...prev, `${logTime} 🔄 Q${index + 1}: "${q.question.slice(0, 40)}..."`]);
    
                try {
                    const res = await fetch('/api/test/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questionId: q.id }),
                    });
    
                    const result = await res.json();
                    if (res.ok) {
                        setTestLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ✅ Q${index + 1}: Score ${result.score}`]);
                    } else {
                        setTestLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ❌ Q${index + 1}: ${result.error}`]);
                    }
                } catch (err) {
                    setTestLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ❗️ Q${index + 1}: Unexpected error`]);
                }
            }
    
            setTestLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} 🎉 All tests complete`]);
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            setTestLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ❗️ Unexpected error: ${err.message}`]);
        } finally {
            setIsTesting(false);
            setTestContext('');
        }
    };

    
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isTesting) {
                e.preventDefault();
                e.returnValue = 'A test is still running. Are you sure you want to leave?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isTesting]);

    useEffect(() => {
        fetchQuestions();
    }, []);

    useEffect(() => {
        if (questions.length > 0) fetchOverallGraph();
    }, [questions]);

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Average Score Over Time' },
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
        <div className="container mx-auto p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Intersight AI Assistant Monitoring</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between mb-4">
                        <Button onClick={() => setOpenAddDialog(true)} disabled={isTesting}>
                            Add Question
                        </Button>
                        {questions.length > 0 && (
                            <Button onClick={handleRunAllTests} disabled={isTesting}>
                                {isTesting ? 'Running Tests…' : 'Run All Tests'}
                            </Button>
                        )}
                    </div>

                    {isTesting && (
                        <div className="bg-zinc-100 border border-zinc-300 rounded p-4 mb-6 text-sm shadow-inner">
                            <div className="font-semibold text-zinc-700 mb-2">
                                🧪 {testContext || 'Running tests...'}
                            </div>
                            <div
                                ref={logRef}
                                className="max-h-64 overflow-y-auto bg-white p-3 border border-zinc-200 rounded text-xs font-mono space-y-1"
                            >
                                {testLogs.map((log, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap">{log}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {overallGraphData && (
                        <div className="mb-8 flex justify-center items-center">
                            <div className="w-full max-w-4xl">
                                <Line data={overallGraphData} options={chartOptions} />
                            </div>
                        </div>
                    )}


                    {questions.length === 0 ? (
                        <div className="text-center py-8">
                            <h2 className="text-lg font-semibold text-gray-600 mb-2">No Questions Yet</h2>
                            <p className="text-gray-500 mb-4">
                                Get started by adding your first question to monitor the Intersight AI Assistant.
                            </p>
                            <Button
                                onClick={() => setOpenAddDialog(true)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Add Your First Question
                            </Button>
                        </div>
                    ) : (
                        <>
                            <QuestionTable
                                questions={questions}
                                fetchQuestions={fetchQuestions}
                                isTesting={isTesting}
                                setIsTesting={setIsTesting}
                                setTestLogs={setTestLogs}
                                setTestContext={setTestContext}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <AddQuestionDialog
                open={openAddDialog}
                setOpen={setOpenAddDialog}
                fetchQuestions={fetchQuestions}
            />
        </div>
    );
}