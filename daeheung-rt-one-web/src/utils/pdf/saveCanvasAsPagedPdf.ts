import {
  DOCUMENT_PDF_FIT_ONE_PAGE_ITEM_THRESHOLD,
  DOCUMENT_PDF_MARGINS_MM,
  getPrintableSizeMm,
  type DocumentPdfMarginsMm,
} from './documentPdfStandard';

export type PagedPdfImageFormat = 'PNG' | 'JPEG';

export type BuildPagedPdfFromCanvasOptions = {
  margins?: DocumentPdfMarginsMm;
  imageFormat?: PagedPdfImageFormat;
  jpegQuality?: number;
  /** 아이템 수 — threshold 미만이면 1페이지 맞춤 축소 */
  itemCount?: number;
  fitOnePageItemThreshold?: number;
  /** true면 itemCount와 무관하게 한 페이지로 축소 */
  forceFitOnePage?: boolean;
  compress?: boolean;
};

type JsPdfCtor = typeof import('jspdf').default;

/**
 * 견적서와 동일: fit-one-page 축소 + 가로 중앙 정렬 + 다중 페이지 슬라이스
 */
export function buildPagedPdfFromCanvas(
  JsPDF: JsPdfCtor,
  canvas: HTMLCanvasElement,
  options: BuildPagedPdfFromCanvasOptions = {}
): InstanceType<JsPdfCtor> {
  const margins = options.margins ?? DOCUMENT_PDF_MARGINS_MM;
  const imageFormat = options.imageFormat ?? 'PNG';
  const jpegQuality = options.jpegQuality ?? 0.87;
  const itemCount = options.itemCount ?? 0;
  const fitThreshold =
    options.fitOnePageItemThreshold ?? DOCUMENT_PDF_FIT_ONE_PAGE_ITEM_THRESHOLD;
  const compress = options.compress ?? true;

  const { widthMm: printableWidthMm, heightMm: printableHeightMm } =
    getPrintableSizeMm(margins);

  const imgData =
    imageFormat === 'PNG'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', jpegQuality);

  const pdf = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress,
  });

  let drawWidth = printableWidthMm;
  let drawHeight = (canvas.height * drawWidth) / canvas.width;

  const forceFitOnePage =
    Boolean(options.forceFitOnePage) || itemCount < fitThreshold;
  if (forceFitOnePage && drawHeight > printableHeightMm) {
    const fit = printableHeightMm / drawHeight;
    drawWidth *= fit;
    drawHeight = printableHeightMm;
  }

  const offsetX = margins.left + (printableWidthMm - drawWidth) / 2;

  if (drawHeight <= printableHeightMm + 0.2) {
    pdf.addImage(imgData, imageFormat, offsetX, margins.top, drawWidth, drawHeight);
    return pdf;
  }

  let heightLeft = drawHeight;
  let position = margins.top;
  pdf.addImage(imgData, imageFormat, offsetX, position, drawWidth, drawHeight);
  heightLeft -= printableHeightMm;

  while (heightLeft > 0.5) {
    pdf.addPage();
    position = margins.top - (drawHeight - heightLeft);
    pdf.addImage(imgData, imageFormat, offsetX, position, drawWidth, drawHeight);
    heightLeft -= printableHeightMm;
  }

  return pdf;
}

/** 하위 호환: 즉시 파일 저장 */
export function saveCanvasAsPagedPdf(
  JsPDF: JsPdfCtor,
  canvas: HTMLCanvasElement,
  options: BuildPagedPdfFromCanvasOptions & { filename: string }
): void {
  const pdf = buildPagedPdfFromCanvas(JsPDF, canvas, options);
  pdf.save(options.filename);
}
