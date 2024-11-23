import {createAnthropic} from '@ai-sdk/anthropic';

interface InterpreterResponse {
    success: boolean;
    output?: string;
    error?: {
        type: string;
        message: string;
        traceback?: string;
    };
    metrics?: {
        execution_time: number;
        memory_usage: number;
        cpu_percent: number;
    };
}

if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

const provider = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'http://localhost:9898/v1',
});

// Create a bash tool that will handle Python code execution via API
const pythonExecutor = provider.tools.bash_20241022({
    execute: async ({command}) => {
        // Detect and execute Python code
        if (command.includes('```python') || command.startsWith('python ')) {
            const pythonCode = command.replace(/```python\n?/, '').replace(/```\n?/, '');

            try {
                const response = await fetch('http://localhost:8000/api/v1/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: pythonCode,
                        output_format: 'rich', // Default to rich output
                        include_metrics: true
                    }),
                });

                const result: InterpreterResponse = await response.json();

                if (!result.success) {
                    return {
                        error: result.error?.message || 'Execution failed',
                        output: result.error?.traceback || '',
                    };
                }

                return {
                    output: result.output,
                    metadata: {
                        execution_time: result.metrics?.execution_time,
                    }
                };
            } catch (error: any) {
                return {
                    error: `Error executing Python code: ${error.message}`,
                    output: '',
                };
            }
        }

        // For regular bash commands
        try {
            const output = require('child_process').execSync(command, {encoding: 'utf8'});
            return {output};
        } catch (error: any) {
            return {
                error: `Error executing bash command: ${error.message}`,
                output: error.stderr || '',
            };
        }
    }
});

// Extend the provider with our custom tool
const enhancedProvider = {
    ...provider,
    languageModel: (modelId: string, settings: any) => {
        return provider.languageModel(modelId, {
            ...settings,
            tools: [pythonExecutor],
        });
    },
};

export default enhancedProvider;
