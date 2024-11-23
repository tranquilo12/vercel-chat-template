import { Check, Copy } from 'lucide-react';
import { FC, useCallback, useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  executionResult?: {
    output?: string;
    error?: {
      message?: string;
      traceback?: string;
    };
    metadata?: {
      execution_time?: number;
    };
  };
  tokenCount?: {
    input: number;
    output: number;
  };
}

export const CodeBlock: FC<CodeBlockProps> = ({
  code,
  language = 'python',
  executionResult,
  tokenCount
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  return (
    <div className="relative my-4 rounded-md bg-slate-900">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <span className="text-sm text-slate-400">{language}</span>
        <button
          onClick={copyToClipboard}
          className="p-1 rounded hover:bg-slate-700 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-slate-50">{code}</code>
      </pre>

      {/* Execution result */}
      {executionResult && (
        <div className="border-t border-slate-700">
          {executionResult.error ? (
            <div className="p-4 bg-red-900/20">
              <p className="text-red-400 font-medium">Error:</p>
              <p className="text-red-300">{executionResult.error.message}</p>
              {executionResult.error.traceback && (
                <pre className="mt-2 text-xs text-red-300 overflow-x-auto">
                  {executionResult.error.traceback}
                </pre>
              )}
            </div>
          ) : executionResult.output ? (
            <div className="p-4 bg-slate-800/50">
              <pre className="text-sm text-slate-200 overflow-x-auto">
                {executionResult.output}
              </pre>
            </div>
          ) : null}
        </div>
      )}

      {/* Token count */}
      {tokenCount && (
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-400">
          Tokens: {tokenCount.input} in / {tokenCount.output} out
        </div>
      )}
    </div>
  );
};
