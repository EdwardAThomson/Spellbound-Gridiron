const BaseAdapter = require('./base');

class GeminiAdapter extends BaseAdapter {
    constructor() {
        super({ binPath: 'gemini' });
    }

    buildCommand(options) {
        // gemini -p "<prompt>" -m gemini-2.5-pro
        const model = options.model || 'gemini-2.5-pro';
        const args = ['-p', options.prompt, '-m', model];

        return {
            command: this.config.binPath,
            args,
            env: {}
        };
    }
}

module.exports = GeminiAdapter;
