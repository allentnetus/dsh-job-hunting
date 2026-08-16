import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
export const extractDocx = async (buffer) => {
    const result = await mammoth.extractRawText({
        buffer: Buffer.from(buffer),
    });
    return {
        text: result.value,
        warnings: result.messages.map((message) => message.message),
    };
};
export const parseDocx = async (buffer) => (await extractDocx(buffer)).text;
//# sourceMappingURL=docx-parser.js.map