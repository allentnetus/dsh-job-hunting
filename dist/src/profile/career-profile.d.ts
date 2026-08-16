import type { CareerProfile, CareerProfileDraft, ProfileFeedback } from '../domain/types.js';
export declare const createDraftProfile: (input: ProfileFeedback) => CareerProfileDraft;
export declare const confirmProfile: (draft: CareerProfileDraft) => CareerProfile;
export declare const updateProfile: (profile: CareerProfile, feedback: ProfileFeedback) => CareerProfileDraft;
