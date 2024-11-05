import {openai} from "@ai-sdk/openai";
import {experimental_wrapLanguageModel as wrapLanguageModel} from "ai";
import {config} from "dotenv";

import {customMiddleware} from "./custom-middleware";
// import {createCustomOpenAI} from "./dify-provider";
import localOpenAI from './custom-oai-provider';

config({
    path: ".env.development.local",
});

export const customModel = wrapLanguageModel({
    model: openai("gpt-4"),
    middleware: customMiddleware,
});

export const localModel = wrapLanguageModel({
    model: localOpenAI("claude-3-5"),
    middleware: customMiddleware,
});
