import { Experimental_LanguageModelV1Middleware } from 'ai';

export const customMiddleware: Experimental_LanguageModelV1Middleware = {
  transformParams: async (options) => {
    return {
      ...options.params,
    };
  },
};
