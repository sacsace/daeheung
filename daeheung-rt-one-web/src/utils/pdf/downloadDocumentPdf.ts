import { loadPdfLibs } from './loadPdfLibs';
import {
  DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
  DOCUMENT_PDF_MARGINS_MM,
  DOCUMENT_PDF_SCALE_DOWNLOAD,
  DOCUMENT_PDF_SCALE_EMAIL,
  injectDocumentPdfStandardCss,
  type DocumentPdfMarginsMm,
} from './documentPdfStandard';
import {
  createOffscreenCaptureClone,
  getOffscreenWidthCss,
  isBlankCanvas,
} from './offscreenCapture';
import { buildPagedPdfFromCanvas, type PagedPdfImageFormat } from './saveCanvasAsPagedPdf';
import { ensurePdfExtension } from './sanitizeFilename';

export type DocumentPdfPurpose = 'download' | 'email';

export type DownloadDocumentPdfOptions = {
  element: HTMLElement;
  filename: string;
  margins?: DocumentPdfMarginsMm;
  purpose?: DocumentPdfPurpose;
  scale?: number;
  imageFormat?: PagedPdfImageFormat;
  jpegQuality?: number;
  itemCount?: number;
  fitOnePageItemThreshold?: number;
  forceFitOnePage?: boolean;
  captureRootAttr?: string;
  onClone?: (clonedDoc: Document) => void;
};

async function captureElementToCanvas(
  element: HTMLElement,
  options: {
    scale: number;
    margins: DocumentPdfMarginsMm;
    captureRootAttr: string;
    onClone?: (clonedDoc: Document) => void;
  }
): Promise<HTMLCanvasElement> {
  const { html2canvas } = await loadPdfLibs();
  const widthCss = getOffscreenWidthCss(options.margins);

  const html2canvasOptions = {
    scale: options.scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc: Document) => {
      injectDocumentPdfStandardCss(clonedDoc);
      options.onClone?.(clonedDoc);
    },
  };

  const offscreen = createOffscreenCaptureClone(element, widthCss, options.captureRootAttr);
  try {
    const captured = await html2canvas(offscreen.clone, html2canvasOptions);
    if (!isBlankCanvas(captured)) return captured;
  } catch {
    // fallback
  } finally {
    offscreen.host.remove();
  }

  const prevWidth = element.style.width;
  const prevMaxWidth = element.style.maxWidth;
  const prevBoxSizing = element.style.boxSizing;
  element.style.boxSizing = 'border-box';
  element.style.width = widthCss;
  element.style.maxWidth = widthCss;
  try {
    return await html2canvas(element, html2canvasOptions);
  } finally {
    element.style.width = prevWidth;
    element.style.maxWidth = prevMaxWidth;
    element.style.boxSizing = prevBoxSizing;
  }
}

export async function downloadDocumentPdf(options: DownloadDocumentPdfOptions): Promise<void> {
  const purpose = options.purpose ?? 'download';
  const margins = options.margins ?? DOCUMENT_PDF_MARGINS_MM;
  const scale =
    options.scale ??
    (purpose === 'email' ? DOCUMENT_PDF_SCALE_EMAIL : DOCUMENT_PDF_SCALE_DOWNLOAD);
  const imageFormat: PagedPdfImageFormat =
    options.imageFormat ?? (purpose === 'email' ? 'JPEG' : 'PNG');
  const jpegQuality = options.jpegQuality ?? 0.87;
  const captureRootAttr = options.captureRootAttr ?? DOCUMENT_PDF_CAPTURE_ROOT_ATTR;

  const { jsPDF } = await loadPdfLibs();
  const canvas = await captureElementToCanvas(options.element, {
    scale,
    margins,
    captureRootAttr,
    onClone: options.onClone,
  });

  const pdf = buildPagedPdfFromCanvas(jsPDF, canvas, {
    margins,
    imageFormat,
    jpegQuality,
    itemCount: options.itemCount ?? 0,
    fitOnePageItemThreshold: options.fitOnePageItemThreshold,
    forceFitOnePage: options.forceFitOnePage,
  });

  pdf.save(ensurePdfExtension(options.filename));
}

export async function documentPdfToBase64(
  options: Omit<DownloadDocumentPdfOptions, 'filename'>
): Promise<string> {
  const purpose = options.purpose ?? 'email';
  const margins = options.margins ?? DOCUMENT_PDF_MARGINS_MM;
  const scale =
    options.scale ??
    (purpose === 'email' ? DOCUMENT_PDF_SCALE_EMAIL : DOCUMENT_PDF_SCALE_DOWNLOAD);
  const imageFormat: PagedPdfImageFormat =
    options.imageFormat ?? (purpose === 'email' ? 'JPEG' : 'PNG');
  const jpegQuality = options.jpegQuality ?? 0.87;
  const captureRootAttr = options.captureRootAttr ?? DOCUMENT_PDF_CAPTURE_ROOT_ATTR;

  const { jsPDF } = await loadPdfLibs();
  const canvas = await captureElementToCanvas(options.element, {
    scale,
    margins,
    captureRootAttr,
    onClone: options.onClone,
  });

  const pdf = buildPagedPdfFromCanvas(jsPDF, canvas, {
    margins,
    imageFormat,
    jpegQuality,
    itemCount: options.itemCount ?? 0,
    fitOnePageItemThreshold: options.fitOnePageItemThreshold,
    forceFitOnePage: options.forceFitOnePage,
  });

  const dataUri = pdf.output('datauristring') as string;
  const comma = dataUri.indexOf(',');
  return comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
}
