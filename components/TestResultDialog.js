import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export default function TestResultDialog({ open, setOpen, question }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (open) {
      fetch(`/api/results/${question.id}`)
        .then((res) => res.json())
        .then((data) => setResults(data.sort((a, b) => b.score - a.score)));
    }
  }, [open, question]);

  const formatScoreColor = (score) => {
    if (score >= 80) return 'bg-green-200 text-green-800';
    if (score >= 50) return 'bg-yellow-200 text-yellow-800';
    return 'bg-red-200 text-red-800';
  };

  const chartData = {
    labels: results.map((r) => new Date(r.created_at).toLocaleDateString()),
    datasets: [
      {
        label: `Score for "${question.question}" (Gradio)`,
        data: results.filter(r => r.source === 'Gradio').map((r) => r.score),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
      },
      {
        label: `Score for "${question.question}" (BridgeIT)`,
        data: results.filter(r => r.source === 'BridgeIT').map((r) => r.score),
        borderColor: 'rgba(192, 75, 192, 1)',
        backgroundColor: 'rgba(192, 75, 192, 0.2)',
        fill: true,
      },
      {
        label: `Score for "${question.question}" (Galileo)`,
        data: results.filter(r => r.source === 'Galileo').map((r) => r.score),
        borderColor: 'rgba(75, 75, 192, 1)',
        backgroundColor: 'rgba(75, 75, 192, 0.2)',
        fill: true,
      },
      {
        label: `Score for "${question.question}" (Team Instance)`,
        data: results.filter(r => r.source === 'IntersightAI-Team-Instance').map((r) => r.score),
        borderColor: 'rgba(255, 165, 0, 1)',
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Score Over Time by Source' },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Score (0–100)' },
      },
      x: {
        title: { display: true, text: 'Date' },
      },
    },
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl overflow-auto max-h-[90vh] min-w-[90%]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Test Results for: <span className="italic">{question.question}</span>
          </DialogTitle>
        </DialogHeader>

        {results.length > 0 && (
          <div className="mb-6">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Rank</TableHead>
                <TableHead className="whitespace-nowrap">Source</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">AI Response</TableHead>
                <TableHead className="whitespace-nowrap">Score</TableHead>
                <TableHead className="whitespace-nowrap">Evaluation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <TableRow key={`${result.id}-${result.source}`}>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="align-top text-sm font-medium">
                    {result.source}
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {new Date(result.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="align-top w-[400px] max-w-[400px] overflow-auto text-sm whitespace-pre-line border-l">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: result.ai_response }}
                    />
                  </TableCell>
                  <TableCell className="align-top text-center">
                    <Badge className={formatScoreColor(result.score)}>
                      {result.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top w-[400px] max-w-[400px] text-sm whitespace-pre-line border-l">
                    <div className="text-muted-foreground">{result.explanation}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
