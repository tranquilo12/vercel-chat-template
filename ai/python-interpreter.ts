import {LanguageModelV1FunctionTool} from '@ai-sdk/provider';
import {JSONSchema7} from 'json-schema';

// Define InterpreterArgs
export interface InterpreterArgs {
    code: string;
    output_format: 'plain' | 'rich' | 'json';
    timeout?: number;
}

// Type for our interpreter response
export interface InterpreterResponse {
    success: boolean;
    output?: string;
    error?: {
        type: string;
        message: string;
    };
}

// Function schema for OpenAI/Claude
export const pythonInterpreterTool: LanguageModelV1FunctionTool = {
    type: 'function',
    name: 'executePythonCode',
    description: 'Execute Python code and return the output',
    parameters: {
        type: 'object',
        required: ['code', 'output_format'],
        properties: {
            code: {
                type: 'string',
                description: 'The Python code to execute'
            },
            output_format: {
                type: 'string',
                enum: ['plain', 'rich', 'json'],
                description: 'The format of the output'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in seconds for code execution'
            }
        }
    } as JSONSchema7
};

// Function to execute the Python code
export async function executePythonCode(args: InterpreterArgs): Promise<InterpreterResponse> {
    try {
        const response = await fetch('http://localhost:8000/api/v1/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(args)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        return {
            success: false,
            error: {
                type: 'ExecutionError',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            }
        };
    }
}
