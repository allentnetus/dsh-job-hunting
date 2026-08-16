const utf8Decoder = new TextDecoder('utf-8');

export const parseText = (buffer: Uint8Array): string => utf8Decoder.decode(buffer);

export const normalizeResumeText = (text: string): string =>
  text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
