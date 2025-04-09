import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
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

            let result;
            try {
                result = await res.json();
            } catch (e) {
                result = { error: 'Invalid JSON response from server.' };
            }

            if (res.ok) {
                setTestLogs((prev) => [...prev, `✅ Score: ${result.score}`, `💬 ${result.explanation}`]);
            } else {
                setTestLogs((prev) => [...prev, `❌ Failed: ${result.error}`]);
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
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {questions.map((question) => (
                        <TableRow key={question.id}>
                            <TableCell className="max-w-[300px]">
                                {editMode === question.id ? (
                                    <Input value={editedQuestion} onChange={(e) => setEditedQuestion(e.target.value)} />
                                ) : (
                                    <div className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={question.question}>
                                        {question.question}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                                {editMode === question.id ? (
                                    <Input value={editedAnswer} onChange={(e) => setEditedAnswer(e.target.value)} />
                                ) : (
                                    <div className="truncate whitespace-nowrap overflow-hidden text-ellipsis" title={question.golden_truth}>
                                        {question.golden_truth}
                                    </div>
                                )}
                            </TableCell>

                            <TableCell className="space-x-2">
                                {editMode === question.id ? (
                                    <>
                                        <Input
                                            placeholder="Password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="inline-block w-[160px]"
                                        />
                                        <Button onClick={() => handleSaveEdit(question.id)}>Save</Button>
                                        <Button variant="secondary" onClick={() => setEditMode(null)}>
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            onClick={() => handleRunTest(question.id, question.question)}
                                            disabled={isTesting}
                                        >
                                            Run Test
                                        </Button>
                                        <Button
                                            onClick={() => handleViewResults(question)}
                                            disabled={isTesting}
                                        >
                                            View Results
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setEditMode(question.id);
                                                setEditedQuestion(question.question);
                                                setEditedAnswer(question.golden_truth);
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        <Button variant="destructive" onClick={() => setDeleteConfirm(question.id)}>
                                            Delete
                                        </Button>
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
                        <Input
                            placeholder="Enter password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                                Delete
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {selectedQuestion && (
                <TestResultDialog
                    open={openResultDialog}
                    setOpen={setOpenResultDialog}
                    question={selectedQuestion}
                />
            )}
        </>
    );
}