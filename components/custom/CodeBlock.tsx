import { Check, Copy } from 'lucide-react';
import { FC, useCallback, useState } from 'react';

interface ExecutionResult {
  output?: string;
  error?: string;
}

interface CodeBlockProps {
  code: string;
  language: string;
  executionResult?: ExecutionResult;
}

export function CodeBlock({ code, language, executionResult }: CodeBlockProps) {
  return (
    <div className="relative">
      <pre className="rounded-lg bg-muted p-4">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      
      {executionResult && (
        <div className="mt-2 rounded-lg bg-muted p-4">
          {executionResult.error ? (
            <div className="text-red-500">
              <span className="font-bold">Error: </span>
              {executionResult.error}
            </div>
          ) : (
            <div className="text-green-500">
              <span className="font-bold">Output: </span>
              <pre className="whitespace-pre-wrap">{executionResult.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
