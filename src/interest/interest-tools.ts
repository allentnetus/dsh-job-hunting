import {
  readWorkspaceJson,
  writeWorkspaceJson,
  type WorkspaceContext,
} from '../workspace/workspace-output.js';
import { markInterest, setInterestNote } from '../domain/interest-ledger.js';
import type { InterestMark, InterestState } from '../domain/types.js';
import { syncInterestExport } from './interest-sync.js';
import type { InterestExport } from '../site/interest-export.js';

export const INTEREST_LEDGER_PATH = 'data/interest-ledger.json';

export interface InterestLedgerStore {
  read(): Promise<InterestState | undefined>;
  write(state: InterestState): Promise<void>;
}

export class InterestStoreNotConfiguredError extends Error {
  readonly code = 'INTEREST_STORE_NOT_CONFIGURED';

  constructor() {
    super(
      'Cannot persist interest changes without an injected Workspace interest store; use createInterestTools with createWorkspaceInterestLedgerStore.',
    );
    this.name = 'InterestStoreNotConfiguredError';
  }
}

export class InterestConfirmationRequiredError extends Error {
  readonly code = 'INTEREST_CONFIRMATION_REQUIRED';

  constructor() {
    super('Explicit user confirmation is required before persisting an interest mark.');
    this.name = 'InterestConfirmationRequiredError';
  }
}

export const createWorkspaceInterestLedgerStore = (
  workspace: WorkspaceContext,
): InterestLedgerStore => ({
  read: () => readWorkspaceJson<InterestState>(workspace.path, INTEREST_LEDGER_PATH),
  write: (state) => writeWorkspaceJson(workspace.path, INTEREST_LEDGER_PATH, state),
});

export const createInterestLedgerStore = createWorkspaceInterestLedgerStore;

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
  updateInterestFromConversation(
    jobId: string,
    mark: InterestMark,
    note?: string,
  ): Promise<void>;
  markInterest(request: ConfirmedInterestUpdate): Promise<void>;
  syncInterest(request: ConfirmedInterestSync): Promise<InterestState>;
}

const emptyInterestState = (updatedAt: string): InterestState => ({
  marks: {},
  notes: {},
  updatedAt,
});

/**
 * Create the operations that a later DSH adapter may register as confirmation-gated tools.
 * Ordinary conversation must not call the store directly; provide an explicit confirmation
 * callback to enable the conversation adapter, or call markInterest with confirmed: true.
 */
export const createInterestTools = (options: InterestToolsOptions): InterestTools => {
  const now = options.now ?? (() => new Date().toISOString());

  const requireConfirmation = async (): Promise<void> => {
    if (!(await options.isConfirmed?.())) {
      throw new InterestConfirmationRequiredError();
    }
  };

  const persistInterestUpdate = async (
    jobId: string,
    mark: InterestMark,
    note?: string,
    confirmedByRequest = false,
  ): Promise<void> => {
    if (!confirmedByRequest) await requireConfirmation();

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
    updateInterestFromConversation: (jobId, mark, note) =>
      persistInterestUpdate(jobId, mark, note),
    async markInterest(request): Promise<void> {
      if (request.confirmed !== true) {
        throw new InterestConfirmationRequiredError();
      }

      await persistInterestUpdate(request.jobId, request.mark, request.note, true);
    },
    async syncInterest(request): Promise<InterestState> {
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
export const updateInterestFromConversation = async (
  _jobId: string,
  _mark: InterestMark,
  _note?: string,
): Promise<void> => {
  throw new InterestStoreNotConfiguredError();
};
