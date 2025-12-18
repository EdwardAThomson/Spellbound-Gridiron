const GATEWAY_URL = 'http://localhost:3001/api';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'error' | 'canceled';
export type BackendType = 'codex' | 'claude' | 'gemini';

export interface TaskResponse {
    id: string;
    status: TaskStatus;
}

export interface LogEntry {
    line: string;
    stream: 'stdout' | 'stderr';
    ts: string;
}

export interface TaskUpdate {
    type: 'status' | 'log' | 'done' | 'error';
    data: any;
}

export const cliService = {
    async createTask(backend: BackendType, prompt: string, cwd?: string): Promise<TaskResponse> {
        const response = await fetch(`${GATEWAY_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ backend, prompt, cwd }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create task: ${response.statusText}`);
        }

        return response.json();
    },

    streamTask(taskId: string, onUpdate: (update: TaskUpdate) => void) {
        const eventSource = new EventSource(`${GATEWAY_URL}/tasks/${taskId}/stream`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onUpdate(data);

                if (data.type === 'done' || data.type === 'error') {
                    eventSource.close();
                }
            } catch (err) {
                console.error('Failed to parse SSE message', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('EventSource error:', err);
            eventSource.close();
            onUpdate({ type: 'error', data: 'Connection lost' });
        };

        return () => {
            eventSource.close();
        };
    }
};
