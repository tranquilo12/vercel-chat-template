'use client'

import { Message } from "ai";
import { useChat } from "ai/react";
import { useRef } from "react";

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to parse and format Python execution results
  const formatMessage = (content: string) => {
    try {
      // Check if the content is a JSON string containing Python execution results
      const parsedContent = JSON.parse(content);
      if (parsedContent.success !== undefined) {
        return (
          <div className="python-result border rounded-lg p-4 my-2 bg-gray-50">
            <div className="text-sm text-gray-500 mb-2">Python Execution Result:</div>
            {parsedContent.success ? (
              <div className="python-output font-mono text-sm bg-white p-3 rounded border">
                {parsedContent.output}
              </div>
            ) : (
              <div className="python-error bg-red-50 text-red-700 p-3 rounded border border-red-200">
                <span className="error-label font-semibold">Error: </span>
                {parsedContent.error?.message || 'Unknown error'}
              </div>
            )}
          </div>
        );
      }

      // Check if content contains Python code
      if (content.includes('```python')) {
        const codeMatch = content.match(/```python\n([\s\S]*?)```/);
        if (codeMatch) {
          return (
            <div className="message-content">
              <div className="mb-2">{content.split('```python')[0]}</div>
              <div className="code-block bg-gray-50 p-4 rounded-lg border my-2">
                <div className="text-sm text-gray-500 mb-2">Generated Python Code:</div>
                <pre className="font-mono text-sm overflow-x-auto">
                  {codeMatch[1].trim()}
                </pre>
              </div>
              <div>{content.split('```')[2]}</div>
            </div>
          );
        }
      }
    } catch {
      // If not a JSON string, return as regular content
    }
    return <div className="message-content whitespace-pre-wrap">{content}</div>;
  };

  return (
    <div className="flex flex-col w-full max-w-3xl py-24 mx-auto stretch">
      <div className="messages-container space-y-4 px-4">
        {messages.map((m: Message) => (
          <div
            key={m.id}
            className={`message p-4 rounded-lg ${
              m.role === 'user' 
                ? 'bg-blue-100 ml-auto max-w-[80%]' 
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="message-role font-semibold mb-2 text-sm text-gray-600">
              {m.role === 'user' ? 'You' : 'Assistant'}:
            </div>
            {m.role === 'assistant' ? formatMessage(m.content) : m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="fixed bottom-0 w-full max-w-3xl p-4 bg-white border-t">
        <input
          className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="Send a message..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
