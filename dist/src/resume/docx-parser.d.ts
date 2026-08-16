export interface DocxParseResult {
    text: string;
    warnings: string[];
}
export declare const extractDocx: (buffer: Uint8Array) => Promise<DocxParseResult>;
export declare const parseDocx: (buffer: Uint8Array) => Promise<string>;
