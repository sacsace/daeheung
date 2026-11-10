import React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from '../../theme';
import EmployeePersonalRecordContent, {
  type EmployeePersonalRecordProps,
} from './EmployeePersonalRecordContent';
import {
  A4_PAGE_MM,
  DOCUMENT_PDF_CAPTURE_ROOT_ATTR,
  type DocumentPdfMarginsMm,
} from '../../utils/pdf';

const A4_WIDTH_MM = A4_PAGE_MM.width;
const A4_HEIGHT_MM = A4_PAGE_MM.height;

/** 좌·우 동일 여백 (문서 공통 20/10과 별도) */
const PERSONAL_RECORD_PDF_MARGINS_MM: DocumentPdfMarginsMm = {
  left: 12,
  right: 12,
  top: 10,
  bottom: 10,
};

/** A4 세로 본문 폭에 맞춘 캡처 너비 */
const PDF_CAPTURE_WIDTH_PX = 780;
/**
 * html2canvas는 비트맵 — scale 3 + PNG로 글자 번짐을 줄인다.
 */
const PDF_CAPTURE_SCALE = 3;

let pdfLibsPromise: Promise<[typeof import('html2canvas'), typeof import('jspdf')]> | null = null;

function loadPdfLibs() {
  if (!pdfLibsPromise) {
    pdfLibsPromise = Promise.all([import('html2canvas'), import('jspdf')]);
  }
  return pdfLibsPromise;
}

function injectPersonalRecordCaptureCss(doc: Document, rootId: string) {
  const root = doc.getElementById(rootId);
  if (!root) return;
  root.setAttribute(DOCUMENT_PDF_CAPTURE_ROOT_ATTR, '');
  if (doc.head.querySelector('[data-personal-record-pdf-capture]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-personal-record-pdf-capture', 'true');
  style.textContent = `
    [${DOCUMENT_PDF_CAPTURE_ROOT_ATTR}],
    [${DOCUMENT_PDF_CAPTURE_ROOT_ATTR}] * {
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: geometricPrecision !important;
      image-rendering: -webkit-optimize-contrast;
    }
  `;
  doc.head.appendChild(style);
}

/** 섹션·행 경계(캔버스 px) — 페이지 나눔 시 중간 짤림 방지 */
function collectBreakPointsPx(root: HTMLElement, scale: number): number[] {
  const rootRect = root.getBoundingClientRect();
  const points = new Set<number>([0]);
  root.querySelectorAll('[data-pdf-break]').forEach((node) => {
    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    const y = Math.round((rect.top - rootRect.top) * scale);
    if (y > 0) points.add(y);
  });
  points.add(Math.round(root.scrollHeight * scale));
  return Array.from(points).sort((a, b) => a - b);
}

type PageSlice = { y: number; h: number };

function buildPageSlices(
  canvasHeight: number,
  usableHPx: number,
  breakPoints: number[]
): PageSlice[] {
  const pages: PageSlice[] = [];
  let cursor = 0;
  const epsilon = 2;

  while (cursor < canvasHeight - epsilon) {
    const maxEnd = Math.min(canvasHeight, cursor + usableHPx);
    if (maxEnd >= canvasHeight - epsilon) {
      pages.push({ y: cursor, h: canvasHeight - cursor });
      break;
    }

    let best = -1;
    for (const bp of breakPoints) {
      if (bp <= cursor + epsilon) continue;
      if (bp <= maxEnd + epsilon) best = bp;
      else break;
    }

    // 경계가 없으면 하드 컷, 있으면 행/섹션 앞에서 자름
    const end = best > cursor + epsilon ? best : maxEnd;
    const h = Math.max(1, end - cursor);
    pages.push({ y: cursor, h });
    cursor = end;
  }

  return pages;
}

export async function generateEmployeePersonalRecordPdfBlob(
  props: EmployeePersonalRecordProps
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await loadPdfLibs();
  const rootId = `employee-record-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';
  container.style.background = '#FFFFFF';
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(
          ThemeProvider,
          { theme },
          React.createElement(
            Box,
            {
              id: rootId,
              sx: {
                bgcolor: '#FFFFFF',
                width: `${PDF_CAPTURE_WIDTH_PX}px`,
                boxSizing: 'border-box',
              },
            },
            React.createElement(CssBaseline),
            React.createElement(EmployeePersonalRecordContent, props)
          )
        )
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await document.fonts.ready;

    const host = document.getElementById(rootId);
    if (host) {
      const imgs = Array.from(host.querySelectorAll('img'));
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(() => resolve(), 2500);
            })
        )
      );
      await new Promise((r) => setTimeout(r, 120));
    }

    const el = document.getElementById(rootId);
    if (!el) throw new Error('PDF_CAPTURE_ROOT_MISSING');

    const canvas = await html2canvas(el, {
      scale: PDF_CAPTURE_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFFFF',
      logging: false,
      width: PDF_CAPTURE_WIDTH_PX,
      windowWidth: PDF_CAPTURE_WIDTH_PX,
      scrollX: 0,
      scrollY: 0,
      letterRendering: true,
      onclone: (clonedDoc: Document) => {
        injectPersonalRecordCaptureCss(clonedDoc, rootId);
      },
    });

    const margins = PERSONAL_RECORD_PDF_MARGINS_MM;
    const pageW = A4_WIDTH_MM;
    const pageH = A4_HEIGHT_MM;
    const printWidthMm = pageW - margins.left - margins.right;
    const usableH = pageH - margins.top - margins.bottom;
    const widthMm = printWidthMm;
    const heightMm = (canvas.height / canvas.width) * widthMm;
    const pxPerMm = canvas.height / heightMm;
    const usableHPx = Math.floor(usableH * pxPerMm);
    // 좌우 동일 여백 — 가로 중앙 정렬
    const offsetX = margins.left + (printWidthMm - widthMm) / 2;
    const offsetY = margins.top;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    if (heightMm <= usableH + 0.2) {
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, widthMm, heightMm, undefined, 'FAST');
    } else {
      const breakPoints = collectBreakPointsPx(el, PDF_CAPTURE_SCALE);
      const slices = buildPageSlices(canvas.height, usableHPx, breakPoints);

      slices.forEach((slice, page) => {
        if (page > 0) pdf.addPage('a4', 'portrait');
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slice.h;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            slice.y,
            canvas.width,
            slice.h,
            0,
            0,
            canvas.width,
            slice.h
          );
        }
        const sliceHMm = slice.h / pxPerMm;
        const sliceData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceData, 'PNG', offsetX, offsetY, widthMm, sliceHMm, undefined, 'FAST');
      });
    }

    return pdf.output('blob');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

export function buildEmployeePersonalRecordFilename(employeeName?: string | null): string {
  const name = String(employeeName || '').trim() || 'Employee';
  const stamp = new Date().toISOString().slice(0, 10);
  return `Employee Personal Record (${name}) (${stamp})`.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
}

export function downloadEmployeePersonalRecordPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
