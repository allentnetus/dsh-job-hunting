import { type WorkspaceContext } from '../workspace/workspace-output.js';
import type { InterestMark, InterestState } from '../domain/types.js';
import type { InterestExport } from '../site/interest-export.js';
export declare const INTEREST_LEDGER_PATH = "data/interest-ledger.json";
export interface InterestLedgerStore {
    read(): Promise<InterestState | undefined>;
    write(state: InterestState): Promise<void>;
}
export declare class InterestStoreNotConfiguredError extends Error {
    readonly code = "INTEREST_STORE_NOT_CONFIGURED";
    constructor();
}
export declare class InterestConfirmationRequiredError extends Error {
    readonly code = "INTEREST_CONFIRMATION_REQUIRED";
    constructor();
}
export declare const createWorkspaceInterestLedgerStore: (workspace: WorkspaceContext) => InterestLedgerStore;
export declare const createInterestLedgerStore: typeof createWorkspaceInterestLedgerStore;
export interface InterestToolsOptions {
    store: InterestLedgerStore;
    now?: () => string;
    isConfirmed?: () => boolean | Promise<boolean>;
}
export interface ConfirmedInterestUpdate {
    jobId: string;
    mark: InterestMark;
    note?: string;
    confirmed: boolean;
}
export interface ConfirmedInterestSync {
    exported: InterestExport;
    confirmed: boolean;
}
export interface InterestTools {
    updateInterestFromConversation(jobId: string, mark: InterestMark, note?: string): Promise<void>;
    markInterest(request: ConfirmedInterestUpdate): Promise<void>;
    syncInterest(request: ConfirmedInterestSync): Promise<InterestState>;
}
/**
 * Create the operations that a later DSH adapter may register as confirmation-gated tools.
 * Ordinary conversation must not call the store directly; provide an explicit confirmation
 * callback to enable the conversation adapter, or call markInterest with confirmed: true.
 */
export declare const createInterestTools: (options: InterestToolsOptions) => InterestTools;
/**
 * Compatibility adapter for the requested three-argument API. It intentionally fails because
 * the signature has no Workspace context and this module keeps persistence free of hidden state.
 * Use createInterestTools({ store, isConfirmed }) for a real, confirmation-gated update.
 */
export declare const updateInterestFromConversation: (_jobId: string, _mark: InterestMark, _note?: string) => Promise<void>;
