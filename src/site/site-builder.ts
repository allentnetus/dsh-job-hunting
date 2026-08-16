import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { JobRecord } from '../domain/types.js';

const templateDirectories = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates/default'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../templates/default'),
];
const dataMarker = '__SITE_DATA__';

export interface SiteData {
  generatedAt: string;
  jobs: readonly JobRecord[];
}

export interface SiteBuildInput {
  outputDir: string;
  jobs: readonly JobRecord[];
  generatedAt?: string;
}

export interface SiteBuildResult {
  indexPath: string;
  assetPaths: string[];
  data: SiteData;
}

const escapeJsonForHtmlScript = (json: string): string =>
  json.replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case '<':
        return '\\u003C';
      case '>':
        return '\\u003E';
      case '&':
        return '\\u0026';
      case '\u2028':
        return '\\u2028';
      case '\u2029':
        return '\\u2029';
      default:
        return character;
    }
  });

const resolveTemplateDirectory = async (): Promise<string> => {
  for (const directory of templateDirectories) {
    try {
      await access(path.join(directory, 'index.html'));
      return directory;
    } catch {
      // Try the next known location for source and compiled layouts.
    }
  }
  throw new Error('Default site templates are missing');
};

export const embedSiteData = (template: string, data: SiteData): string => {
  if (!template.includes(dataMarker)) {
    throw new Error(`Site template is missing ${dataMarker}`);
  }

  const serializedData = escapeJsonForHtmlScript(JSON.stringify(data));
  const dataScript = `<script id="site-data" type="application/json">${serializedData}</script>`;
  return template.replace(dataMarker, dataScript);
};

export const buildSite = async (input: SiteBuildInput): Promise<SiteBuildResult> => {
  const data: SiteData = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    jobs: input.jobs,
  };
  const indexPath = path.join(input.outputDir, 'index.html');
  const cssPath = path.join(input.outputDir, 'app.css');
  const jsPath = path.join(input.outputDir, 'app.js');

  await mkdir(input.outputDir, { recursive: true });
  const templateDirectory = await resolveTemplateDirectory();
  const [indexTemplate, css, js] = await Promise.all([
    readFile(path.join(templateDirectory, 'index.html'), 'utf8'),
    readFile(path.join(templateDirectory, 'app.css'), 'utf8'),
    readFile(path.join(templateDirectory, 'app.js'), 'utf8'),
  ]);

  await Promise.all([
    writeFile(indexPath, embedSiteData(indexTemplate, data), 'utf8'),
    writeFile(cssPath, css, 'utf8'),
    writeFile(jsPath, js, 'utf8'),
  ]);

  return {
    indexPath,
    assetPaths: [cssPath, jsPath],
    data,
  };
};
