import { useMemo } from 'react';

import { cn } from '@/lib/utils';

interface JsonFormatterProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function JsonFormatter({ content, isStreaming, className }: JsonFormatterProps) {
  const formattedContent = useMemo(() => {
    try {
      // Handle streaming content by attempting to parse incomplete JSON
      if (isStreaming) {
        // Try to balance brackets/braces for incomplete JSON
        let balancedContent = content;
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;

        // Add missing closing braces/brackets
        balancedContent += '}}'.repeat(Math.max(0, openBraces - closeBraces));
        balancedContent += ']'.repeat(Math.max(0, openBrackets - closeBrackets));

        const parsed = JSON.parse(balancedContent);
        return JSON.stringify(parsed, null, 2);
      }

      // For complete JSON
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Return original content if parsing fails
      return content;
    }
  }, [content, isStreaming]);

  return (
    <pre
      className={cn(
        "bg-muted p-4 rounded-md overflow-x-auto",
        isStreaming && "animate-pulse",
        className
      )}
    >
      <code className="text-sm">{formattedContent}</code>
    </pre>
  );
} 