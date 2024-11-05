import { createOpenAI } from '@ai-sdk/openai';

const localOpenAI = createOpenAI({
  baseURL: 'http://localhost:4000',
  compatibility: 'compatible', // Use compatible mode for custom endpoints
  // apiKey: 'dummy-key', // Required but can be any value since we're using local endpoint
  headers: {
    // Add any custom headers needed for your local server
    'Content-Type': 'application/json'
  }
});

export default localOpenAI;
