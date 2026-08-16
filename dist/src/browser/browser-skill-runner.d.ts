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
export type BskCommandExecutor = (executable: string, args: readonly string[]) => Promise<BskCommandResult>;
export declare class SafeBskRunner implements BskRunner {
    private readonly executable;
    private readonly execute;
    constructor(executable?: string, execute?: BskCommandExecutor);
    run(args: readonly string[]): Promise<BskCommandResult>;
}
export declare const createSafeBskRunner: (executable?: string, execute?: BskCommandExecutor) => BskRunner;
export declare const checkBrowserSkill: (executable: string, runner?: BskRunner) => Promise<BrowserSkillStatus>;
