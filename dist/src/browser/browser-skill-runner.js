import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const defaultCommandExecutor = async (executable, args) => {
    try {
        const result = await execFileAsync(executable, [...args], {
            windowsHide: true,
            maxBuffer: 4 * 1024 * 1024,
        });
        return {
            exitCode: 0,
            stdout: String(result.stdout),
            stderr: String(result.stderr),
        };
    }
    catch (error) {
        const commandError = error;
        return {
            exitCode: typeof commandError.code === 'number' ? commandError.code : 1,
            stdout: commandError.stdout === undefined ? '' : String(commandError.stdout),
            stderr: commandError.stderr === undefined ? commandError.message : String(commandError.stderr),
        };
    }
};
export class SafeBskRunner {
    executable;
    execute;
    constructor(executable = 'bsk', execute = defaultCommandExecutor) {
        this.executable = executable;
        this.execute = execute;
    }
    run(args) {
        return this.execute(this.executable, args);
    }
}
export const createSafeBskRunner = (executable = 'bsk', execute = defaultCommandExecutor) => new SafeBskRunner(executable, execute);
export const checkBrowserSkill = async (executable, runner = createSafeBskRunner(executable)) => {
    try {
        const result = await runner.run(['status']);
        if (result.exitCode !== 0) {
            return {
                available: false,
                executable,
                message: result.stderr?.trim() || result.stdout.trim() || 'status command failed',
            };
        }
        try {
            const payload = JSON.parse(result.stdout);
            return {
                available: payload.available !== false,
                executable,
                ...(typeof payload.version === 'string' ? { version: payload.version } : {}),
                ...(payload.available === false ? { message: 'BrowserSkill reported unavailable' } : {}),
            };
        }
        catch {
            return {
                available: true,
                executable,
            };
        }
    }
    catch (error) {
        return {
            available: false,
            executable,
            message: error instanceof Error ? error.message : String(error),
        };
    }
};
//# sourceMappingURL=browser-skill-runner.js.map