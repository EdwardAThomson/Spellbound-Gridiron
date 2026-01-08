const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const runner = require('./runner');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Routes
app.post('/api/tasks', (req, res) => {
    const { backend, prompt, cwd, model } = req.body;

    // Create a new runner instance for this task
    try {
        const taskId = runner.createTask({ backend, prompt, cwd, model });
        res.json({ id: taskId, status: 'queued' });
    } catch (error) {
        console.error('Task creation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tasks/:id/stream', (req, res) => {
    const { id } = req.params;

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        runner.streamTask(id, res);
    } catch (error) {
        console.error('Stream failed:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`LLM Runner Gateway listening on port ${PORT}`);
});
