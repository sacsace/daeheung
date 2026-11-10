/**
 * Document text extraction for Accounting Brain / Auto Voucher.
 * - CSV/TXT/JSON: direct read
 * - PDF: pdf-parse when available
 * - Images: OpenAI Vision when OPENAI_API_KEY is set
 * Never posts accounting data.
 */
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { env } from '../config/env';

export type ExtractedDocumentText = {
  text: string;
  engine: 'text' | 'pdf-parse' | 'openai-vision' | 'none';
  confidence: number;
  notes: string[];
};

const isPdf = (mime?: string, ext?: string) =>
  String(mime || '').includes('pdf') || ext === '.pdf';

const isImage = (mime?: string, ext?: string) => {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return true;
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tif', '.tiff', '.bmp'].includes(ext || '');
};

const isPlainText = (mime?: string, ext?: string) => {
  const m = String(mime || '').toLowerCase();
  return (
    m.includes('csv') ||
    m.includes('text') ||
    m.includes('json') ||
    ['.csv', '.txt', '.json', '.md'].includes(ext || '')
  );
};

async function extractPdfText(absolutePath: string): Promise<ExtractedDocumentText> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse');
    const buffer = await fs.readFile(absolutePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => undefined);
    }
    const text = String(result?.text || '').trim();
    return {
      text,
      engine: 'pdf-parse',
      confidence: text.length > 40 ? 0.9 : text.length > 0 ? 0.65 : 0.2,
      notes: text ? ['PDF text layer extracted'] : ['PDF had little/no extractable text'],
    };
  } catch (err: any) {
    return {
      text: '',
      engine: 'none',
      confidence: 0,
      notes: [`pdf-parse unavailable: ${err?.message || 'error'}`],
    };
  }
}

async function extractImageWithOpenAI(absolutePath: string, mime?: string): Promise<ExtractedDocumentText> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      text: '',
      engine: 'none',
      confidence: 0,
      notes: ['OPENAI_API_KEY not configured — image OCR skipped'],
    };
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    const b64 = buffer.toString('base64');
    const mediaType = mime && mime.startsWith('image/') ? mime : 'image/jpeg';
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You extract accounting document text for bookkeeping. Return plain text only: vendor/customer, invoice number, date, amounts, GSTIN/PAN, line items if visible. Do not invent values.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all readable invoice/receipt/bank-slip text for accounting recommendation. Plain text only.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mediaType};base64,${b64}` },
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const text = String(response.data?.choices?.[0]?.message?.content || '').trim();
    return {
      text,
      engine: 'openai-vision',
      confidence: text.length > 40 ? 0.86 : text.length > 0 ? 0.6 : 0.25,
      notes: text ? ['OpenAI Vision OCR completed'] : ['OpenAI Vision returned empty text'],
    };
  } catch (err: any) {
    return {
      text: '',
      engine: 'none',
      confidence: 0,
      notes: [`OpenAI Vision failed: ${err?.response?.data?.error?.message || err?.message || 'error'}`],
    };
  }
}

const isSpreadsheet = (mime?: string, ext?: string) => {
  const m = String(mime || '').toLowerCase();
  return (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    ['.xlsx', '.xls', '.csv'].includes(ext || '')
  );
};

async function extractSpreadsheetText(absolutePath: string, ext: string): Promise<ExtractedDocumentText> {
  try {
    if (ext === '.csv') {
      const text = await fs.readFile(absolutePath, 'utf-8');
      return {
        text: String(text || ''),
        engine: 'text',
        confidence: text.trim().length > 0 ? 0.95 : 0.1,
        notes: ['CSV read as text'],
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(absolutePath, { cellDates: true });
    const sheets = workbook.SheetNames || [];
    const chunks: string[] = [];
    for (const name of sheets.slice(0, 5)) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      chunks.push(`# Sheet: ${name}\n${csv}`);
    }
    const text = chunks.join('\n\n').trim();
    return {
      text,
      engine: 'text',
      confidence: text.length > 40 ? 0.9 : text.length > 0 ? 0.55 : 0.15,
      notes: text ? [`Spreadsheet parsed (${sheets.length} sheet(s))`] : ['Spreadsheet had no extractable cells'],
    };
  } catch (err: any) {
    return {
      text: '',
      engine: 'none',
      confidence: 0,
      notes: [`Spreadsheet parse failed: ${err?.message || 'error'}`],
    };
  }
}

export async function extractTextFromDocument(
  absolutePath: string,
  mimetype?: string
): Promise<ExtractedDocumentText> {
  const ext = path.extname(absolutePath).toLowerCase();

  if (isPlainText(mimetype, ext) && ext !== '.csv') {
    try {
      const text = await fs.readFile(absolutePath, 'utf-8');
      return {
        text: String(text || ''),
        engine: 'text',
        confidence: text.trim().length > 0 ? 0.95 : 0.1,
        notes: ['Plain text read'],
      };
    } catch {
      return { text: '', engine: 'none', confidence: 0, notes: ['Failed to read text file'] };
    }
  }

  if (isSpreadsheet(mimetype, ext) || ext === '.csv') {
    return extractSpreadsheetText(absolutePath, ext || '.xlsx');
  }

  if (isPdf(mimetype, ext)) {
    return extractPdfText(absolutePath);
  }

  if (isImage(mimetype, ext)) {
    return extractImageWithOpenAI(absolutePath, mimetype);
  }

  return {
    text: '',
    engine: 'none',
    confidence: 0,
    notes: [`Unsupported file type: ${mimetype || ext || 'unknown'}`],
  };
}
