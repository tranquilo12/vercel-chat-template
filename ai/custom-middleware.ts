import { Experimental_LanguageModelV1Middleware } from 'ai';
import { pythonInterpreterTool } from './python-interpreter';

export const customMiddleware: Experimental_LanguageModelV1Middleware = {
  transformParams: async (options) => {
    return {
      ...options.params,
      mode: {
        type: 'regular',
        tools: [pythonInterpreterTool],
        toolChoice: { type: 'auto' },
      },
    };
  },
};
