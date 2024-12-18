import { FC, useEffect, useRef } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { highlightCode } from '@/lib/syntax-highlighting';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

const CodeBlock: FC<CodeBlockProps> = ({ inline, className, children }) => {
  const codeRef = useRef<HTMLElement>(null);
  const language = className?.split('-')[1] || 'plaintext';

  useEffect(() => {
    if (!inline && codeRef.current) {
      const code = codeRef.current.textContent || '';
      codeRef.current.innerHTML = highlightCode(code, language);
    }
  }, [inline, language]);

  if (inline) {
    return (
      <code className="text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md">
        {children}
      </code>
    );
  }

  return (
    <code
      ref={codeRef}
      className={`${language} syntax-highlighted whitespace-pre-wrap block w-[80dvw] md:max-w-[500px] overflow-x-auto text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded-md`}
    >
      {children}
    </code>
  );
};

export const Markdown: FC<{ children: string }> = ({ children }) => {
  // Define explicit parameter types for all custom renderers to avoid "implicitly has 'any' type" errors
  const components: Components = {
    code: ({ inline = false, className, children }: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode
    }) => (
      <CodeBlock inline={inline} className={className}>
        {children}
      </CodeBlock>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-outside ml-4">
        {children}
      </ol>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-outside ml-4">
        {children}
      </ul>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="py-1">
        {children}
      </li>
    )
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
};
