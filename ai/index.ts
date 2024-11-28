import { experimental_wrapLanguageModel as wrapLanguageModel } from "ai";
import { config } from "dotenv";

import { customMiddleware } from "./custom-middleware";
import customOpenAIProvider from "./custom-oai-provider";

config({
    path: ".env.development.local",
});

export const openaiModel = wrapLanguageModel({
    model: customOpenAIProvider.languageModel("gpt-4o"),
    middleware: customMiddleware,
});
