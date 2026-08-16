import path from 'node:path';
import { defaultConfig } from './default-config.js';
const assertObject = (value, field) => {
    if (value === undefined) {
        return {};
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(`${field} must be an object`);
    }
    return value;
};
const assertBoolean = (value, field, fallback) => {
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== 'boolean') {
        throw new TypeError(`${field} must be a boolean`);
    }
    return value;
};
const assertNonEmptyString = (value, field, fallback) => {
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${field} must be a non-empty string`);
    }
    return value.trim();
};
const assertScheduleTime = (value, fallback) => {
    const resolved = assertNonEmptyString(value, 'schedule.time', fallback);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(resolved)) {
        throw new TypeError('schedule.time must be in HH:MM format');
    }
    return resolved;
};
const assertRelativeDirectory = (value, field, fallback) => {
    const resolved = assertNonEmptyString(value, field, fallback);
    if (path.isAbsolute(resolved)) {
        throw new TypeError(`${field} must be a relative path, not an absolute path`);
    }
    const normalized = path.normalize(resolved);
    if (normalized === '..' ||
        normalized.startsWith(`..${path.sep}`) ||
        path.isAbsolute(path.relative('.', normalized))) {
        throw new TypeError(`${field} must stay inside the workspace and must not contain ".."`);
    }
    return normalized;
};
export const parseConfig = (input = {}) => {
    const root = assertObject(input, 'config');
    const schedule = assertObject(root.schedule, 'schedule');
    const browserSkill = assertObject(root.browserSkill, 'browserSkill');
    const desktopShortcut = assertObject(root.desktopShortcut, 'desktopShortcut');
    const scheduleMode = schedule.mode ?? defaultConfig.schedule.mode;
    if (scheduleMode !== 'session-reminder') {
        throw new TypeError('schedule.mode must be "session-reminder"');
    }
    const browserMode = browserSkill.mode ?? defaultConfig.browserSkill.mode;
    if (browserMode !== 'read-only') {
        throw new TypeError('browserSkill.mode must be "read-only"');
    }
    const allowedDomainsInput = browserSkill.allowedDomains ?? defaultConfig.browserSkill.allowedDomains;
    if (!Array.isArray(allowedDomainsInput)) {
        throw new TypeError('browserSkill.allowedDomains must be an array');
    }
    const allowedDomains = allowedDomainsInput.map((domain, index) => assertNonEmptyString(domain, `browserSkill.allowedDomains[${index}]`, ''));
    const additionalAllowedDomainsInput = browserSkill.additionalAllowedDomains ?? defaultConfig.browserSkill.additionalAllowedDomains;
    if (!Array.isArray(additionalAllowedDomainsInput)) {
        throw new TypeError('browserSkill.additionalAllowedDomains must be an array');
    }
    const additionalAllowedDomains = additionalAllowedDomainsInput.map((domain, index) => assertNonEmptyString(domain, `browserSkill.additionalAllowedDomains[${index}]`, ''));
    const resolvedAllowedDomains = [...new Set([...allowedDomains, ...additionalAllowedDomains])];
    const maxItemsPerRun = browserSkill.maxItemsPerRun === undefined
        ? defaultConfig.browserSkill.maxItemsPerRun
        : browserSkill.maxItemsPerRun;
    if (typeof maxItemsPerRun !== 'number' ||
        !Number.isInteger(maxItemsPerRun) ||
        maxItemsPerRun <= 0) {
        throw new TypeError('browserSkill.maxItemsPerRun must be a positive integer');
    }
    const minIntervalMs = browserSkill.minIntervalMs === undefined
        ? defaultConfig.browserSkill.minIntervalMs
        : browserSkill.minIntervalMs;
    if (typeof minIntervalMs !== 'number' ||
        !Number.isInteger(minIntervalMs) ||
        minIntervalMs <= 0) {
        throw new TypeError('browserSkill.minIntervalMs must be a positive integer');
    }
    return {
        outputDir: assertRelativeDirectory(root.outputDir, 'outputDir', defaultConfig.outputDir),
        schedule: {
            enabled: assertBoolean(schedule.enabled, 'schedule.enabled', defaultConfig.schedule.enabled),
            mode: 'session-reminder',
            time: assertScheduleTime(schedule.time, defaultConfig.schedule.time),
            timezone: assertNonEmptyString(schedule.timezone, 'schedule.timezone', defaultConfig.schedule.timezone),
        },
        browserSkill: {
            enabled: assertBoolean(browserSkill.enabled, 'browserSkill.enabled', defaultConfig.browserSkill.enabled),
            executable: assertNonEmptyString(browserSkill.executable, 'browserSkill.executable', defaultConfig.browserSkill.executable),
            mode: 'read-only',
            allowedDomains: resolvedAllowedDomains,
            additionalAllowedDomains,
            requireUserApproval: assertBoolean(browserSkill.requireUserApproval, 'browserSkill.requireUserApproval', defaultConfig.browserSkill.requireUserApproval),
            maxItemsPerRun,
            minIntervalMs,
        },
        desktopShortcut: {
            enabled: assertBoolean(desktopShortcut.enabled, 'desktopShortcut.enabled', defaultConfig.desktopShortcut.enabled),
            name: assertNonEmptyString(desktopShortcut.name, 'desktopShortcut.name', defaultConfig.desktopShortcut.name),
            requireApproval: assertBoolean(desktopShortcut.requireApproval, 'desktopShortcut.requireApproval', defaultConfig.desktopShortcut.requireApproval),
        },
    };
};
//# sourceMappingURL=schema.js.map