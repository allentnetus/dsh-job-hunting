const utf8Decoder = new TextDecoder('utf-8');
export const parseText = (buffer) => utf8Decoder.decode(buffer);
export const normalizeResumeText = (text) => text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
//# sourceMappingURL=text-parser.js.map