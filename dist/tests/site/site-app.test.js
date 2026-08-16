import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSite } from '../../src/site/site-builder.js';
class FakeClassList {
    values = new Set();
    add(value) {
        this.values.add(value);
    }
    contains(value) {
        return this.values.has(value);
    }
}
class FakeElement {
    tagName;
    children = [];
    classList = new FakeClassList();
    attributes = new Map();
    listeners = new Map();
    className = '';
    textContent = '';
    value = '';
    rows = 0;
    placeholder = '';
    type = '';
    href = '';
    target = '';
    rel = '';
    download = '';
    constructor(tagName) {
        this.tagName = tagName;
    }
    append(...elements) {
        this.children.push(...elements);
    }
    replaceChildren(...elements) {
        this.children.splice(0, this.children.length, ...elements);
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    dispatchEvent(event) {
        for (const listener of this.listeners.get(event.type) ?? [])
            listener();
        return true;
    }
    click() {
        this.dispatchEvent({ type: 'click' });
    }
    setAttribute(name, value) {
        this.attributes.set(name, value);
    }
    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }
    querySelectorAll(selector) {
        return this.children.flatMap((child) => [
            ...(child.tagName === selector ? [child] : []),
            ...child.querySelectorAll(selector),
        ]);
    }
}
class FakeDocument {
    elements = new Map();
    register(id, element) {
        this.elements.set(id, element);
    }
    getElementById(id) {
        return this.elements.get(id) ?? null;
    }
    createElement(tagName) {
        return new FakeElement(tagName);
    }
}
const job = {
    id: 'job-1',
    source: 'local',
    title: 'Data Analyst',
    company: 'Acme',
    location: 'Shanghai',
    requirements: ['SQL'],
    url: 'https://jobs.example.test/1',
    collectedAt: '2026-08-16T08:00:00.000Z',
};
const tempDirs = [];
afterEach(async () => {
    await Promise.all(tempDirs.splice(0, tempDirs.length).map((directory) => rm(directory, { recursive: true, force: true })));
});
const createBrowser = (storage) => {
    const document = new FakeDocument();
    const listElement = new FakeElement('section');
    document.register('site-data', Object.assign(new FakeElement('script'), {
        textContent: JSON.stringify({ jobs: [job] }),
    }));
    document.register('job-list', listElement);
    document.register('job-count', new FakeElement('span'));
    document.register('status-message', new FakeElement('p'));
    document.register('search-input', new FakeElement('input'));
    document.register('mark-filter', Object.assign(new FakeElement('select'), { value: 'all' }));
    document.register('export-button', new FakeElement('button'));
    return { document, listElement, storage };
};
const runGeneratedApp = async (storage) => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-site-app-'));
    tempDirs.push(outputDir);
    const result = await buildSite({ outputDir, jobs: [job], generatedAt: '2026-08-16T09:00:00.000Z' });
    const appSource = await readFile(result.assetPaths[1], 'utf8');
    const browser = createBrowser(storage);
    const exportedPayloads = [];
    class CapturedBlob {
        parts;
        constructor(parts) {
            this.parts = parts;
        }
    }
    class DownloadUrl extends URL {
        static createObjectURL(blob) {
            exportedPayloads.push(blob.parts.join(''));
            return 'blob:test';
        }
        static revokeObjectURL(_id) { }
    }
    vm.runInNewContext(appSource, {
        Blob: CapturedBlob,
        JSON,
        URL: DownloadUrl,
        document: browser.document,
        localStorage: browser.storage,
        window: { location: { href: 'https://jobs.example.test/' } },
    });
    return { ...browser, exportedPayloads };
};
describe('generated site app', () => {
    it('gives every generated notes textarea an accessible name', async () => {
        const browser = await runGeneratedApp({
            getItem: () => null,
            setItem: () => undefined,
        });
        const notes = browser.listElement.querySelectorAll('textarea');
        expect(notes).toHaveLength(1);
        expect(notes[0]?.getAttribute('aria-label')).toBe('岗位备注：Data Analyst');
    });
    it('does not break mark or note events when localStorage writes fail', async () => {
        const browser = await runGeneratedApp({
            getItem: () => null,
            setItem: () => {
                throw new Error('storage quota exceeded');
            },
        });
        const initialButtons = browser.listElement.querySelectorAll('button');
        expect(() => initialButtons[0]?.click()).not.toThrow();
        expect(browser.listElement.querySelectorAll('button')[0]?.classList.contains('is-active')).toBe(true);
        const note = browser.listElement.querySelectorAll('textarea')[0];
        note.value = '  需要复核  ';
        expect(() => note.dispatchEvent({ type: 'change' })).not.toThrow();
        const search = browser.document.getElementById('search-input');
        search.dispatchEvent({ type: 'input' });
        expect(browser.listElement.querySelectorAll('textarea')[0]?.value).toBe('需要复核');
    });
    it('includes knownJobIds in the interest export payload', async () => {
        const browser = await runGeneratedApp({
            getItem: () => null,
            setItem: () => undefined,
        });
        browser.document.getElementById('export-button').click();
        expect(JSON.parse(browser.exportedPayloads[0])).toMatchObject({
            knownJobIds: ['job-1'],
        });
    });
});
//# sourceMappingURL=site-app.test.js.map