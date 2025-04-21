import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Filter, ArrowUpDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const sources = ['All', 'Gradio', 'BridgeIT', 'Galileo', 'IntersightAI-Team-Instance', 'FinAI'];
const sortOptions = ['Newest First', 'Oldest First'];

export default function MetaEvalDialog({ open, setOpen }) {
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [filteredSource, setFilteredSource] = useState('All');
  const [sortOrder, setSortOrder] = useState('Newest First');

  const loadEvaluations = () => {
    fetch('/api/meta-eval')
      .then((res) => res.json())
      .then(setEvaluations)
      .catch((err) => {
        console.error('Failed to load saved meta evals', err);
      });
  };

  useEffect(() => {
    if (open) loadEvaluations();
  }, [open]);

  const runMetaEval = async () => {
    setLoading(true);
    try {
      for (const source of sources.filter(s => s !== 'All')) {
        await fetch('/api/meta-eval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source }),
        });
      }
      loadEvaluations();
    } catch (err) {
      console.error('Meta evaluation failed', err);
    } finally {
      setLoading(false);
    }
  };
  

  const filteredEvals = Array.isArray(evaluations)
    ? evaluations
      .filter((e) => filteredSource === 'All' || e.source === filteredSource)
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === 'Newest First' ? timeB - timeA : timeA - timeB;
      })
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl min-w-[90%] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            📊 Meta Evaluation Results
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex gap-4">
            <Select value={filteredSource} onValueChange={setFilteredSource}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select Source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort Order" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={runMetaEval} disabled={loading}>
            {loading ? 'Evaluating...' : 'Run Meta Evaluation'}
          </Button>
        </div>

        {filteredEvals.length > 0 ? (
          <ScrollArea className="h-[65vh] rounded border bg-muted p-4">
            {filteredEvals.map((evalObj, i) => {
              const sourceColors = {
                Gradio: 'bg-teal-100 text-teal-800 border-teal-300',
                BridgeIT: 'bg-pink-100 text-pink-800 border-pink-300',
                Galileo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                'IntersightAI-Team-Instance': 'bg-orange-100 text-orange-800 border-orange-300',
                FinAI: 'bg-purple-100 text-purple-800 border-purple-300',
                Default: 'bg-gray-100 text-gray-800 border-gray-300',
              };

              const colorClass = sourceColors[evalObj.source] || sourceColors.Default;

              return (
                <div
                  key={i}
                  className="p-5 rounded-xl mb-4 bg-white shadow border hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded-full border ${colorClass}`}
                    >
                      {evalObj.source}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(evalObj.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                    <div className="text-teal-700">
                      <strong>Accuracy:</strong> {evalObj.accuracy}
                    </div>
                    <div className="text-pink-700">
                      <strong>Completeness:</strong> {evalObj.completeness}
                    </div>
                    <div className="text-indigo-700">
                      <strong>Clarity:</strong> {evalObj.clarity}
                    </div>
                    <div className="text-orange-700">
                      <strong>Consistency:</strong> {evalObj.consistency}
                    </div>
                    <div className="col-span-2 sm:col-span-3 text-gray-900">
                      <strong>Overall:</strong> {evalObj.overall}
                    </div>
                  </div>

                  <div className="prose prose-sm text-gray-700 max-w-none">
  <ReactMarkdown>
    {evalObj.summary}
  </ReactMarkdown>
</div>
                </div>
              );
            })}
          </ScrollArea>
        ) : (
          <div className="text-sm text-center text-gray-500 py-8">
            No meta evaluations found. Click <strong>"Run Meta Evaluation"</strong> to generate them.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
