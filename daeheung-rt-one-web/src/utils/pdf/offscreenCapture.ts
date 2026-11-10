import {
  DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
  DOCUMENT_PDF_MARGINS_MM,
  getPrintableSizeMm,
  type DocumentPdfMarginsMm,
} from './documentPdfStandard';

/**
 * 화면 레이아웃을 흔들지 않도록 A4 인쇄 폭을 적용한 복제본을 화면 밖에 만든다.
 * cloneNode는 input/textarea/select 현재 값을 복사하지 않으므로 직접 옮긴다.
 */
export function createOffscreenCaptureClone(
  element: HTMLElement,
  widthCss: string,
  captureRootAttr: string = DOCUMENT_PDF_CAPTURE_ROOT_ATTR
): { host: HTMLElement; clone: HTMLElement } {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute(captureRootAttr, 'true');
  clone.style.boxSizing = 'border-box';
  clone.style.width = widthCss;
  clone.style.maxWidth = widthCss;

  const sources = element.querySelectorAll<HTMLElement>('input, textarea, select');
  const targets = clone.querySelectorAll<HTMLElement>('input, textarea, select');
  sources.forEach((src, index) => {
    const dst = targets[index];
    if (!dst) return;
    if (src instanceof HTMLInputElement && dst instanceof HTMLInputElement) {
      dst.value = src.value;
      dst.setAttribute('value', src.value);
      dst.checked = src.checked;
    } else if (src instanceof HTMLTextAreaElement && dst instanceof HTMLTextAreaElement) {
      dst.value = src.value;
      dst.textContent = src.value;
    } else if (src instanceof HTMLSelectElement && dst instanceof HTMLSelectElement) {
      dst.value = src.value;
    }
  });

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'z-index:-1',
    'pointer-events:none',
    'background:#ffffff',
    `width:${widthCss}`,
  ].join(';');
  host.appendChild(clone);
  document.body.appendChild(host);
  return { host, clone };
}

/** 축소 샘플링으로 전부 흰색인지 확인 (오프스크린 캡처 실패 감지) */
export function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  if (!canvas.width || !canvas.height) return true;
  try {
    const probeSize = 40;
    const probe = document.createElement('canvas');
    probe.width = probeSize;
    probe.height = probeSize;
    const ctx = probe.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, probeSize, probeSize);
    ctx.drawImage(canvas, 0, 0, probeSize, probeSize);
    const { data } = ctx.getImageData(0, 0, probeSize, probeSize);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveCaptureRoot(
  doc: Document,
  options: { captureRootAttr?: string; liveRootSelector?: string }
): HTMLElement | null {
  const attr = options.captureRootAttr || DOCUMENT_PDF_CAPTURE_ROOT_ATTR;
  const byAttr = doc.querySelector(`[${attr}]`) as HTMLElement | null;
  if (byAttr) return byAttr;
  if (options.liveRootSelector) {
    return doc.querySelector(options.liveRootSelector) as HTMLElement | null;
  }
  return null;
}

export function getOffscreenWidthCss(
  margins: DocumentPdfMarginsMm = DOCUMENT_PDF_MARGINS_MM
): string {
  const { widthMm } = getPrintableSizeMm(margins);
  return `${widthMm}mm`;
}
