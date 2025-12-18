const BaseAdapter = require('./base');

class ClaudeAdapter extends BaseAdapter {
    constructor() {
        super({ binPath: 'claude' });
    }

    buildCommand(options) {
        // claude -p "<prompt>" --output-format json
        // Note: Claude CLI typically runs in the CWD of the shell
        const args = ['-p', options.prompt];

        // We might want to force non-interactive or JSON mode if available, 
        // but looking at reference, it uses --output-format json
        args.push('--output-format', 'json');

        return {
            command: this.config.binPath,
            args,
            env: {}
        };
    }
}

module.exports = ClaudeAdapter;
