import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export default function AddQuestionDialog({ open, setOpen, fetchQuestions }) {
    const [question, setQuestion] = useState('');
    const [goldenTruth, setGoldenTruth] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [bulkData, setBulkData] = useState('');
    const [activeTab, setActiveTab] = useState('single');
    const [parsedQuestions, setParsedQuestions] = useState([]);

    const resetFields = () => {
        setQuestion('');
        setGoldenTruth('');
        setPassword('');
        setShowPassword(false);
        setError('');
        setBulkData('');
    };

    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/questions/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, goldenTruth, password }),
        });

        if (res.ok) {
            fetchQuestions();
            setOpen(false);
            resetFields();
        } else {
            const { error } = await res.json();
            setError(error || 'Failed to add question.');
        }
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        setError('');
      
        let parsed = [];
      
        // Try to parse JSON directly
        try {
          const raw = JSON.parse(bulkData);
          if (Array.isArray(raw)) {
            parsed = raw;
          } else {
            throw new Error();
          }
        } catch {
          // Fallback parsing logic
          try {
            const lines = bulkData.split('\n').map(line => line.trim()).filter(Boolean);
            const temp = [];
      
            if (lines.every(line => line.includes('::'))) {
              // Format: Q :: A
              for (const line of lines) {
                const [question, goldenTruth] = line.split('::').map(x => x.trim());
                if (!question || !goldenTruth) throw new Error('Missing question or answer.');
                temp.push({ question, goldenTruth });
              }
            } else if (lines.length % 2 === 0) {
              // Format: Q\nA\nQ\nA
              for (let i = 0; i < lines.length; i += 2) {
                const question = lines[i];
                const goldenTruth = lines[i + 1];
                if (!question || !goldenTruth) throw new Error('Missing question or answer.');
                temp.push({ question, goldenTruth });
              }
            } else {
              throw new Error('Unrecognized bulk format. Use Q :: A or alternating lines.');
            }
      
            parsed = temp;
          } catch (err) {
            setError('❌ Invalid bulk input: ' + err.message);
            return;
          }
        }
      
        // Submit formatted payload
        const res = await fetch('/api/questions/bulk-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: parsed, password }),
        });
      
        if (res.ok) {
          fetchQuestions();
          setOpen(false);
          resetFields();
        } else {
          const { error } = await res.json();
          setError(error || 'Failed to bulk add questions.');
        }
      };      

    const handleFormatPreview = () => {
        setError('');
        const lines = bulkData.split('\n').map(line => line.trim()).filter(Boolean);
        const temp = [];
      
        try {
          if (lines.every(line => line.includes('::'))) {
            // Format 1: Q :: A
            for (const line of lines) {
              const [question, goldenTruth] = line.split('::').map(x => x.trim());
              if (!question || !goldenTruth) throw new Error('Missing question or answer.');
              temp.push({ question, goldenTruth });
            }
          } else if (lines.length % 2 === 0) {
            // Format 2: Q\nA\nQ\nA
            for (let i = 0; i < lines.length; i += 2) {
              const question = lines[i];
              const goldenTruth = lines[i + 1];
              if (!question || !goldenTruth) throw new Error('Missing question or answer.');
              temp.push({ question, goldenTruth });
            }
          } else {
            throw new Error('Uneven number of lines. Provide Q/A pairs.');
          }
      
          setParsedQuestions(temp);
        } catch (err) {
          setParsedQuestions([]);
          setError('❌ Invalid format: ' + err.message);
        }
      };
      
    return (
        <Dialog open={open} onOpenChange={setOpen}>
<DialogContent className="max-w-2xl min-w-[90%] max-h-[80vh] overflow-y-auto">
<DialogHeader>
                    <DialogTitle>Add New Question(s)</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="single">Single</TabsTrigger>
                        <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
                    </TabsList>

                    {/* Single Question Mode */}
                    <TabsContent value="single">
                        <form onSubmit={handleSingleSubmit} className="space-y-4">
                            <div>
                                <Label>Question</Label>
                                <Input
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Golden Truth Answer</Label>
                                <Input
                                    value={goldenTruth}
                                    onChange={(e) => setGoldenTruth(e.target.value)}
                                    required
                                />
                            </div>
                            <PasswordInput password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} />
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <Button type="submit" disabled={!question || !goldenTruth || !password}>
                                Add Question
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Bulk Upload Mode */}
                    <TabsContent value="bulk">
                        <form onSubmit={handleBulkSubmit} className="space-y-4">
                            <div>
                                <Label>Paste Questions & Answers</Label>
                                <Textarea
                                    rows={10}
                                    placeholder={`Format 1:\nWhat is X? :: Answer to X\nWhat is Y? :: Answer to Y\n\nOR Format 2:\nWhat is X?\nAnswer to X\nWhat is Y?\nAnswer to Y`}
                                    value={bulkData}
                                    onChange={(e) => setBulkData(e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="button" onClick={handleFormatPreview}>Preview & Format</Button>

                            {parsedQuestions.length > 0 && (
                                <div className="bg-zinc-100 p-3 border rounded text-sm">
                                    <p className="font-semibold mb-2">Preview ({parsedQuestions.length} items):</p>
                                    <ul className="space-y-1 max-h-64 overflow-y-auto text-xs">
                                        {parsedQuestions.map((q, idx) => (
                                            <li key={idx}>
                                                <span className="font-medium">Q:</span> {q.question} <br />
                                                <span className="font-medium">A:</span> {q.goldenTruth}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <PasswordInput password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} />

                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <Button type="submit" disabled={parsedQuestions.length === 0 || !password}>
                                Upload All
                            </Button>
                        </form>
                    </TabsContent>

                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function PasswordInput({ password, setPassword, showPassword, setShowPassword }) {
    return (
        <div>
            <Label>Password</Label>
            <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <div className="mt-1 flex items-center space-x-2">
                <input
                    type="checkbox"
                    id="show-password"
                    checked={showPassword}
                    onChange={() => setShowPassword((prev) => !prev)}
                    className="form-checkbox"
                />
                <label htmlFor="show-password" className="text-sm text-gray-600">
                    Show password
                </label>
            </div>
        </div>
    );
}
