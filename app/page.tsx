'use client';

import { useState } from 'react';

type FinishResponse = {
  quiz: string;
  feedback: string;
  suggestions: string;
  fileUrl?: string;
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<FinishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError('Please select a PDF file before generating a quiz.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('title', title);

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate quiz.');
      }

      setResult(data as FinishResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while generating quiz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1>Smart Quiz Generator</h1>
        <p>Upload your notes as a PDF and generate a quiz, feedback, and improvement suggestions.</p>
      </section>

      <section className="panel-card">
        <form onSubmit={handleSubmit} className="upload-form">
          <label>
            Document title (optional)
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Thermodynamics summary"
            />
          </label>

          <label>
            Upload PDF notes
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Generating quiz…' : 'Generate Quiz'}
          </button>

          {error ? <p className="error-message">{error}</p> : null}
        </form>
      </section>

      {result ? (
        <section className="panel-card result-card">
          <h2>Generated quiz</h2>
          <div className="result-block">
            <h3>Quiz</h3>
            <pre>{result.quiz}</pre>
          </div>

          <div className="result-block">
            <h3>Feedback</h3>
            <p>{result.feedback}</p>
          </div>

          <div className="result-block">
            <h3>Suggestions for improvement</h3>
            <p>{result.suggestions}</p>
          </div>

          {result.fileUrl ? (
            <div className="result-block">
              <h3>Uploaded note</h3>
              <a href={result.fileUrl} target="_blank" rel="noreferrer">
                View uploaded PDF
              </a>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
