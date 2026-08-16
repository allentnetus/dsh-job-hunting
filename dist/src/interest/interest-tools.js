import { readWorkspaceJson, writeWorkspaceJson, } from '../workspace/workspace-output.js';
import { markInterest, setInterestNote } from '../domain/interest-ledger.js';
import { syncInterestExport } from './interest-sync.js';
export const INTEREST_LEDGER_PATH = 'data/interest-ledger.json';
export class InterestStoreNotConfiguredError extends Error {
    code = 'INTEREST_STORE_NOT_CONFIGURED';
    constructor() {
        super('Cannot persist interest changes without an injected Workspace interest store; use createInterestTools with createWorkspaceInterestLedgerStore.');
        this.name = 'InterestStoreNotConfiguredError';
    }
}
export class InterestConfirmationRequiredError extends Error {
    code = 'INTEREST_CONFIRMATION_REQUIRED';
    constructor() {
        super('Explicit user confirmation is required before persisting an interest mark.');
        this.name = 'InterestConfirmationRequiredError';
    }
}
export const createWorkspaceInterestLedgerStore = (workspace) => ({
    read: () => readWorkspaceJson(workspace.path, INTEREST_LEDGER_PATH),
    write: (state) => writeWorkspaceJson(workspace.path, INTEREST_LEDGER_PATH, state),
});
export const createInterestLedgerStore = createWorkspaceInterestLedgerStore;
const emptyInterestState = (updatedAt) => ({
    marks: {},
    notes: {},
    updatedAt,
});
/**
 * Create the operations that a later DSH adapter may register as confirmation-gated tools.
 * Ordinary conversation must not call the store directly; provide an explicit confirmation
 * callback to enable the conversation adapter, or call markInterest with confirmed: true.
 */
export const createInterestTools = (options) => {
    const now = options.now ?? (() => new Date().toISOString());
    const requireConfirmation = async () => {
        if (!(await options.isConfirmed?.())) {
            throw new InterestConfirmationRequiredError();
        }
    };
    const persistInterestUpdate = async (jobId, mark, note, confirmedByRequest = false) => {
        if (!confirmedByRequest)
            await requireConfirmation();
        const current = (await options.store.read()) ?? emptyInterestState(now());
        const withMark = markInterest(current, jobId, mark);
        const next = note === undefined
            ? withMark
            : setInterestNote(withMark, jobId, note);
        await options.store.write({
            ...next,
            updatedAt: now(),
        });
    };
    return {
        updateInterestFromConversation: (jobId, mark, note) => persistInterestUpdate(jobId, mark, note),
        async markInterest(request) {
            if (request.confirmed !== true) {
                throw new InterestConfirmationRequiredError();
            }
            await persistInterestUpdate(request.jobId, request.mark, request.note, true);
        },
        async syncInterest(request) {
            if (request.confirmed !== true) {
                throw new InterestConfirmationRequiredError();
            }
            const current = (await options.store.read()) ?? emptyInterestState(request.exported.updatedAt);
            const next = syncInterestExport(request.exported, current);
            await options.store.write(next);
            return next;
        },
    };
};
/**
 * Compatibility adapter for the requested three-argument API. It intentionally fails because
 * the signature has no Workspace context and this module keeps persistence free of hidden state.
 * Use createInterestTools({ store, isConfirmed }) for a real, confirmation-gated update.
 */
export const updateInterestFromConversation = async (_jobId, _mark, _note) => {
    throw new InterestStoreNotConfiguredError();
};
//# sourceMappingURL=interest-tools.js.map