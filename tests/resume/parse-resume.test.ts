import { describe, expect, it } from 'vitest';

import { parseDocx } from '../../src/resume/docx-parser.js';
import { parseTextPdf } from '../../src/resume/pdf-parser.js';
import { parseResume, unsupportedFormatError } from '../../src/resume/parse-resume.js';

const docxFixtureBase64 =
  'UEsDBBQAAAAIAEl3EF0gG4bqtgAAAC4BAAALAAAAX3JlbHMvLnJlbHONz7FOxDAQBNA+X7Ha/uIcBUIozjUnpGtR+ADL3iQW9q7l9UHu72koOERBOxq90YynPSf4oKpR2OKxHxCIvYTIq8W3+eXwhKDNcXBJmCzeSPE0deMrJdeisG6xKOw5sVrcWivPxqjfKDvtpRDvOS1Ss2vaS11Ncf7drWQehuHR1J8GTh3AHQuXYLFewhFhvhX6Dy/LEj2dxV8zcftj5VcDYXZ1pWbxU2ow4Tvu95zQTN1o7m5OX1BLAwQUAAAACABJdxBda+kNub8AAAArAQAAEQAAAHdvcmQvZG9jdW1lbnQueG1sdY/BSsQwEIbv+xQhd5u6B5GQZlmQPXgUfYDYjN1CZqZksqZ9e8muetLL8P0/fPCPO6yY1CdkmZkGfd/1WgGNHGeaBv32erp71EpKoBgSEwx6A9EHv3PVRh4vCFTUionE1kGfS1msMTKeAYN0vACtmD44YyjScZ5M5RyXzCOIzDRhMvu+fzAYZtJ+p5Sr9p3j1vAalhtdOXtXbfHPgUC9gFwQnGlFu/nbML/K3/JTKEEdKaRNyv92g9uMRj9v+i9QSwMEFAAAAAgASXcQXdd5hOryAAAAuAEAABMAAABbQ29udGVudF9UeXBlc10ueG1sfZDLTsMwEEX3/Qprtqh2YIEQitMFjyWwKB9g2ZPEqj22PG5I/x6lhSIhyvo+zp1pN3MMYsLCPpGGa9mAQLLJeRo0vG+f13cguBpyJiRCDQdk2HSrdnvIyGKOgVjDWGu+V4rtiNGwTBlpjqFPJZrKMpVBZWN3ZkB10zS3yiaqSHVdlw7oVkK0j9ibfajiaa5Ipy0FA4N4OHkXnAaTc/DWVJ9ITeR+gdZfEFkwHD08+sxXcwygLkEW8TLjJ/o6YSneoXgzpb6YiBrURypOuWT3EanK/5v+WJv63ls855e2XJJFZk9DDPKsROPp+4pWHR/ffQJQSwECFAAUAAAACABJdxBdIBuG6rYAAAAuAQAACwAAAAAAAAAAAAAAAAAAAAAAX3JlbHMvLnJlbHNQSwECFAAUAAAACABJdxBda+kNub8AAAArAQAAEQAAAAAAAAAAAAAAAADfAAAAd29yZC9kb2N1bWVudC54bWxQSwECFAAUAAAACABJdxBd13mE6vIAAAC4AQAAEwAAAAAAAAAAAAAAAADNAQAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLBQYAAAAAAwADALkAAADwAgAAAAA=';

const textPdfFixtureBase64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA2OSA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDEwMCBUZAooSmFuZSBSZXN1bWUpIFRqCjAgLTMwIFRkCihEYXRhIEFuYWx5c3QpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzYwIDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDMwCiUlRU9G';

const blankPdfFixtureBase64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvUmVzb3VyY2VzIDw8ID4+IC9Db250ZW50cyA0IDAgUiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDAgPj4Kc3RyZWFtCgplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDUgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjI2OAolJUVPRg==';

const decodeBase64 = (value: string): Uint8Array => Buffer.from(value, 'base64');

describe('resume parsing', () => {
  it('用真实 DOCX 提取原始文本', async () => {
    const text = await parseDocx(decodeBase64(docxFixtureBase64));

    expect(text).toContain('Jane Resume');
    expect(text).toContain('Data Analyst');
  });

  it('用真实文字型 PDF 提取原始文本', async () => {
    const text = await parseTextPdf(decodeBase64(textPdfFixtureBase64));

    expect(text).toContain('Jane Resume');
    expect(text).toContain('Data Analyst');
  });

  it('扫描版或无文字层 PDF 返回 UNSUPPORTED_SCANNED_PDF', async () => {
    await expect(parseTextPdf(decodeBase64(blankPdfFixtureBase64))).rejects.toMatchObject({
      name: 'ResumeParseError',
      code: 'UNSUPPORTED_SCANNED_PDF',
      format: 'pdf',
    });
  });

  it('解析纯文本时保留原始文本并单独给出规范化文本', async () => {
    const result = await parseResume({
      name: 'resume.txt',
      mediaType: 'text/plain',
      buffer: Buffer.from('Jane Resume\r\n\r\nSkills: SQL  \r\n'),
    });

    expect(result).toMatchObject({
      fileName: 'resume.txt',
      format: 'text',
      extractedText: 'Jane Resume\r\n\r\nSkills: SQL  \r\n',
      normalizedText: 'Jane Resume\n\nSkills: SQL',
      warnings: [],
    });
  });

  it('Markdown 按文本简历处理', async () => {
    const result = await parseResume({
      name: 'resume.md',
      mediaType: 'text/markdown',
      buffer: Buffer.from('# Jane Resume\n\n- SQL\n'),
    });

    expect(result.format).toBe('markdown');
    expect(result.extractedText).toContain('# Jane Resume');
    expect(result.normalizedText).toContain('- SQL');
  });

  it('图片文件返回明确可操作错误', async () => {
    await expect(
      parseResume({
        name: 'resume.png',
        mediaType: 'image/png',
        buffer: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
      }),
    ).rejects.toMatchObject({
      name: 'ResumeParseError',
      code: 'UNSUPPORTED_IMAGE_FORMAT',
      format: 'png',
    });
  });

  it('加密 PDF 返回明确可操作错误', async () => {
    await expect(
      parseResume({
        name: 'locked.pdf',
        mediaType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R >>\nendobj\n%%EOF', 'utf8'),
      }),
    ).rejects.toMatchObject({
      name: 'ResumeParseError',
      code: 'UNSUPPORTED_ENCRYPTED_PDF',
      format: 'pdf',
    });
  });

  it('未知格式通过 unsupportedFormatError 返回统一指引', () => {
    const error = unsupportedFormatError('xls');

    expect(error).toMatchObject({
      name: 'ResumeParseError',
      code: 'UNSUPPORTED_FORMAT',
      format: 'xls',
    });
    expect(error.message).toContain('DOCX');
    expect(error.message).toContain('PDF');
  });
});
