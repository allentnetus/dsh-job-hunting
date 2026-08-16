import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BskCommandResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface BskRunner {
  run(args: readonly string[]): Promise<BskCommandResult>;
}

export interface BrowserSkillStatus {
  available: boolean;
  executable: string;
  version?: string;
  message?: string;
}

export type BskCommandExecutor = (
  executable: string,
  args: readonly string[],
) => Promise<BskCommandResult>;

const defaultCommandExecutor: BskCommandExecutor = async (executable, args) => {
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
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };

    return {
      exitCode: typeof commandError.code === 'number' ? commandError.code : 1,
      stdout: commandError.stdout === undefined ? '' : String(commandError.stdout),
      stderr: commandError.stderr === undefined ? commandError.message : String(commandError.stderr),
    };
  }
};

export class SafeBskRunner implements BskRunner {
  constructor(
    private readonly executable = 'bsk',
    private readonly execute: BskCommandExecutor = defaultCommandExecutor,
  ) {}

  run(args: readonly string[]): Promise<BskCommandResult> {
    return this.execute(this.executable, args);
  }
}

export const createSafeBskRunner = (
  executable = 'bsk',
  execute: BskCommandExecutor = defaultCommandExecutor,
): BskRunner => new SafeBskRunner(executable, execute);

export const checkBrowserSkill = async (
  executable: string,
  runner: BskRunner = createSafeBskRunner(executable),
): Promise<BrowserSkillStatus> => {
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
      const payload = JSON.parse(result.stdout) as { available?: unknown; version?: unknown };
      return {
        available: payload.available !== false,
        executable,
        ...(typeof payload.version === 'string' ? { version: payload.version } : {}),
        ...(payload.available === false ? { message: 'BrowserSkill reported unavailable' } : {}),
      };
    } catch {
      return {
        available: true,
        executable,
      };
    }
  } catch (error) {
    return {
      available: false,
      executable,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};
