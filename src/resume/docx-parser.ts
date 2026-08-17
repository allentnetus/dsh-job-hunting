import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mammoth: typeof import('mammoth') = require('mammoth');

export interface DocxParseResult {
  text: string;
  warnings: string[];
}

export const extractDocx = async (buffer: Uint8Array): Promise<DocxParseResult> => {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });

  return {
    text: result.value,
    warnings: result.messages.map((message) => message.message),
  };
};

export const parseDocx = async (buffer: Uint8Array): Promise<string> =>
  (await extractDocx(buffer)).text;
