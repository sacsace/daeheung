import { useMemo } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';

export function isTouchMobileOrTabletDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';

  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;

  return false;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** 휴대폰·태블릿 브라우저 접속 여부 */
export function useIsMobileOrTablet(): boolean {
  const theme = useTheme();
  const isCoarsePointer = useMediaQuery('(hover: none) and (pointer: coarse)');
  const isNarrow = useMediaQuery(theme.breakpoints.down('lg'));
  const isUaMobile = useMemo(() => isTouchMobileOrTabletDevice(), []);

  return isUaMobile || (isCoarsePointer && isNarrow);
}
