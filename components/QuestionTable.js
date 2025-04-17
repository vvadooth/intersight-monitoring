import { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TestResultDialog from './TestResultDialog';

export default function QuestionTable({
    questions,
    fetchQuestions,
    isTesting,
    setIsTesting,
    setTestLogs,
    setTestContext,
}) {
    const [openResultDialog, setOpenResultDialog] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [editMode, setEditMode] = useState(null);
    const [editedQuestion, setEditedQuestion] = useState('');
    const [editedAnswer, setEditedAnswer] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [password, setPassword] = useState('');
    const [averageScores, setAverageScores] = useState({});

    const formatScoreColor = (score) => {
        if (score === 'N/A') return 'bg-gray-200 text-gray-800';
        const val = parseFloat(score);
        if (val >= 80) return 'bg-green-200 text-green-800';
        if (val >= 50) return 'bg-yellow-200 text-yellow-800';
        return 'bg-red-200 text-red-800';
    };

    useEffect(() => {
        const fetchAverageScores = async () => {
            const scores = {};
            for (const question of questions) {
                try {
                    const res = await fetch(`/api/results/${question.id}`);
                    const results = await res.json();

                    const gradio = results.filter(r => r.source === 'Gradio');
                    const bridgeIT = results.filter(r => r.source === 'BridgeIT');
                    const galileo = results.filter(r => r.source === 'Galileo');
                    const teamInstance = results.filter(r => r.source === 'IntersightAI-Team-Instance');

                    const avg = (arr) => arr.length > 0 ? (arr.reduce((sum, r) => sum + r.score, 0) / arr.length).toFixed(1) : 'N/A';

                    scores[question.id] = {
                        gradio: avg(gradio),
                        bridgeIT: avg(bridgeIT),
                        galileo: avg(galileo),
                        teamInstance: avg(teamInstance),
                    };
                } catch (error) {
                    console.error(`Failed to fetch results for question ${question.id}:`, error);
                    scores[question.id] = { gradio: 'N/A', bridgeIT: 'N/A', galileo: 'N/A', teamInstance: 'N/A' };
                }
            }
            setAverageScores(scores);
        };

        if (questions.length > 0) fetchAverageScores();
    }, [questions]);

    const handleRunTest = async (questionId, questionText) => {
        if (isTesting) return;
        setIsTesting(true);
        setTestContext(`Running test for: "${questionText.slice(0, 50)}..."`);
        setTestLogs([`🧪 Running test for: "${questionText}"`]);

        try {
            const res = await fetch('/api/test/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId }),
            });

            let results;
            try {
                results = await res.json();
            } catch (e) {
                results = { error: 'Invalid JSON response from server.' };
            }

            if (res.ok) {
                results.forEach((result) => {
                    setTestLogs((prev) => [
                        ...prev,
                        `${new Date().toLocaleTimeString()} ✅ ${result.source}: Score ${result.score}`,
                        `💬 ${result.explanation.slice(0, 100)}...`,
                    ]);
                });
            } else {
                setTestLogs((prev) => [...prev, `❌ Failed: ${results.error}`]);
            }

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            setTestLogs((prev) => [...prev, `❗️ Unexpected error: ${err.message}`]);
        } finally {
            setIsTesting(false);
            setTestContext('');
        }
    };

    const handleViewResults = (question) => {
        setSelectedQuestion(question);
        setOpenResultDialog(true);
    };

    const handleSaveEdit = async (id) => {
        const res = await fetch('/api/questions/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, question: editedQuestion, goldenTruth: editedAnswer, password }),
        });
        if (res.ok) {
            fetchQuestions();
            setEditMode(null);
            setPassword('');
        } else {
            alert('Failed to update question');
        }
    };

    const handleDelete = async (id) => {
        const res = await fetch('/api/questions/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
        });
        if (res.ok) {
            fetchQuestions();
            setDeleteConfirm(null);
            setPassword('');
        } else {
            alert('Failed to delete question');
        }
    };

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Golden Truth</TableHead>
                        <TableHead>Avg Gradio</TableHead>
                        <TableHead>Avg BridgeIT</TableHead>
                        <TableHead>Avg Galileo</TableHead>
                        <TableHead>Avg Team Instance</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {questions.map((q) => (
                        <TableRow key={q.id}>
                            <TableCell className="max-w-[300px]">
                                {editMode === q.id ? (
                                    <Input value={editedQuestion} onChange={(e) => setEditedQuestion(e.target.value)} />
                                ) : (
                                    <div className="truncate" title={q.question}>{q.question}</div>
                                )}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                                {editMode === q.id ? (
                                    <Input value={editedAnswer} onChange={(e) => setEditedAnswer(e.target.value)} />
                                ) : (
                                    <div className="truncate" title={q.golden_truth}>{q.golden_truth}</div>
                                )}
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge className={formatScoreColor(averageScores[q.id]?.gradio)}>{averageScores[q.id]?.gradio || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge className={formatScoreColor(averageScores[q.id]?.bridgeIT)}>{averageScores[q.id]?.bridgeIT || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge className={formatScoreColor(averageScores[q.id]?.galileo)}>{averageScores[q.id]?.galileo || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge className={formatScoreColor(averageScores[q.id]?.teamInstance)}>{averageScores[q.id]?.teamInstance || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="space-x-2">
                                {editMode === q.id ? (
                                    <>
                                        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="inline-block w-[160px]" />
                                        <Button onClick={() => handleSaveEdit(q.id)}>Save</Button>
                                        <Button variant="secondary" onClick={() => setEditMode(null)}>Cancel</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button onClick={() => handleRunTest(q.id, q.question)} disabled={isTesting}>Run Test</Button>
                                        <Button onClick={() => handleViewResults(q)} disabled={isTesting}>View Results</Button>
                                        <Button variant="outline" onClick={() => {
                                            setEditMode(q.id);
                                            setEditedQuestion(q.question);
                                            setEditedAnswer(q.golden_truth);
                                        }}>Edit</Button>
                                        <Button variant="destructive" onClick={() => setDeleteConfirm(q.id)}>Delete</Button>
                                    </>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {deleteConfirm && (
                <Dialog open={true} onOpenChange={() => setDeleteConfirm(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                        </DialogHeader>
                        <p className="mb-2">Are you sure you want to delete this question?</p>
                        <Input placeholder="Enter password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {selectedQuestion && (
                <TestResultDialog open={openResultDialog} setOpen={setOpenResultDialog} question={selectedQuestion} />
            )}
        </>
    );
}
