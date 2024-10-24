import {openai} from "@ai-sdk/openai";
import {experimental_wrapLanguageModel as wrapLanguageModel, LanguageModelV1} from "ai";
import {config} from "dotenv";

import {customMiddleware} from "./custom-middleware";
import {createCustomOpenAI} from "./custom-openai-provider";

config({
    path: ".env.development.local",
});

export const customModel = wrapLanguageModel({
    model: openai("gpt-4"),
    middleware: customMiddleware,
});

const difyProvider = createCustomOpenAI({
    baseURL: process.env.DIFY_BASE_URL!,
    apiKey: process.env.DIFY_API_KEY!
});

export const difyModel: LanguageModelV1 = wrapLanguageModel({
    model: difyProvider("gpt-3.5-turbo-0125"),
    middleware: customMiddleware
});
