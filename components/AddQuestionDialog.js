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

export default function AddQuestionDialog({ open, setOpen, fetchQuestions }) {
  const [question, setQuestion] = useState('');
  const [goldenTruth, setGoldenTruth] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
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
      setQuestion('');
      setGoldenTruth('');
      setPassword('');
      setShowPassword(false);
    } else {
      const { error } = await res.json();
      setError(error || 'Failed to add question.');
    }
  };

  const isFormValid = question && goldenTruth && password;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Question</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={!isFormValid}>
            Add Question
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
