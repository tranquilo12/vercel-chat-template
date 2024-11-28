import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModelV1 } from '@ai-sdk/provider';


const localOpenAI = createOpenAI({
    baseURL: 'http://localhost:4000',
    compatibility: 'compatible',
    headers: {
        'Content-Type': 'application/json'
    }
});

const customOpenAIProvider = {
    ...localOpenAI,
    languageModel: (modelId: string, settings?: any): LanguageModelV1 => {
        const model = localOpenAI.languageModel(modelId, {
            ...settings,
        });
        const originalDoGenerate = model.doGenerate.bind(model);
        const originalDoStream = model.doStream.bind(model);
        return model;
    }
};

export default customOpenAIProvider;
