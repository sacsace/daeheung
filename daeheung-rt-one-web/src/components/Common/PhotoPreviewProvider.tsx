import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  GlobalStyles,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useTranslation } from 'react-i18next';
import { downloadUploadFile } from '../../utils/uploadUrl';

type PhotoPreviewContextValue = {
  openPhotoPreview: (url: string, alt?: string, sourcePath?: string) => void;
  closePhotoPreview: () => void;
};

const PhotoPreviewContext = createContext<PhotoPreviewContextValue | null>(null);

export function usePhotoPreview(): PhotoPreviewContextValue {
  const ctx = useContext(PhotoPreviewContext);
  if (!ctx) {
    throw new Error('usePhotoPreview must be used within PhotoPreviewProvider');
  }
  return ctx;
}

/** Provider 밖에서도 안전하게 호출 (없으면 no-op) */
export function usePhotoPreviewOptional(): PhotoPreviewContextValue | null {
  return useContext(PhotoPreviewContext);
}

function resolvePreviewUrlFromTarget(target: EventTarget | null): {
  url: string;
  alt: string;
  sourcePath: string;
} | null {
  if (!(target instanceof Element)) return null;

  // 헤더 유저 메뉴 등 — 미리보기 제외
  if (target.closest('[data-no-photo-preview]')) return null;

  const explicit = target.closest('[data-photo-preview]') as HTMLElement | null;
  if (explicit) {
    const url =
      explicit.getAttribute('data-photo-preview') ||
      (explicit instanceof HTMLImageElement ? explicit.currentSrc || explicit.src : '') ||
      explicit.querySelector('img')?.currentSrc ||
      explicit.querySelector('img')?.src ||
      '';
    if (!url) return null;
    const alt =
      explicit.getAttribute('data-photo-preview-alt') ||
      (explicit instanceof HTMLImageElement ? explicit.alt : '') ||
      explicit.querySelector('img')?.alt ||
      '';
    const sourcePath =
      explicit.getAttribute('data-photo-preview-src') ||
      explicit.querySelector('img')?.getAttribute('data-photo-preview-src') ||
      url;
    return { url, alt, sourcePath };
  }

  const avatarRoot = target.closest('.MuiAvatar-root');
  if (avatarRoot) {
    const img = avatarRoot.querySelector('img.MuiAvatar-img, img') as HTMLImageElement | null;
    const url = img?.currentSrc || img?.src || '';
    if (!url) return null;
    return {
      url,
      alt: img?.alt || '',
      sourcePath: img?.getAttribute('data-photo-preview-src') || url,
    };
  }

  if (target instanceof HTMLImageElement) {
    const url = target.currentSrc || target.src;
    if (!url) return null;
    // 장식/아이콘성 작은 이미지는 제외
    if (target.width > 0 && target.height > 0 && target.width < 24 && target.height < 24) {
      return null;
    }
    if (target.closest('button, a, [role="button"]') && !target.hasAttribute('data-photo-preview')) {
      return null;
    }
    return {
      url,
      alt: target.alt || '',
      sourcePath: target.getAttribute('data-photo-preview-src') || url,
    };
  }

  return null;
}

export const PhotoPreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAlt, setPreviewAlt] = useState('');
  const [previewSourcePath, setPreviewSourcePath] = useState('');

  const openPhotoPreview = useCallback((url: string, alt = '', sourcePath = '') => {
    const trimmed = String(url || '').trim();
    if (!trimmed) return;
    setPreviewUrl(trimmed);
    setPreviewAlt(alt);
    setPreviewSourcePath(sourcePath || trimmed);
  }, []);

  const closePhotoPreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewAlt('');
    setPreviewSourcePath('');
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // 텍스트 선택 드래그 중 무시
      if (window.getSelection()?.toString()) return;

      const resolved = resolvePreviewUrlFromTarget(event.target);
      if (!resolved) return;

      event.preventDefault();
      event.stopPropagation();
      openPhotoPreview(resolved.url, resolved.alt, resolved.sourcePath);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openPhotoPreview]);

  const value = useMemo(
    () => ({ openPhotoPreview, closePhotoPreview }),
    [openPhotoPreview, closePhotoPreview]
  );

  return (
    <PhotoPreviewContext.Provider value={value}>
      <GlobalStyles
        styles={{
          // 명시적으로 사진 미리보기를 켠 요소만 줌(+) 커서
          '[data-photo-preview]': {
            cursor: 'zoom-in',
          },
          // 헤더 계정·보드 멤버 등 — 미리보기/줌(+) 커서 제외
          '[data-no-photo-preview], [data-no-photo-preview] .MuiAvatar-root, [data-no-photo-preview].MuiAvatar-root, [data-no-photo-preview] img, [data-no-photo-preview] [data-photo-preview]':
            {
              cursor: 'pointer !important',
            },
        }}
      />
      {children}
      <Dialog
        open={Boolean(previewUrl)}
        onClose={closePhotoPreview}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'transparent',
          }}
          onClick={closePhotoPreview}
        >
          {previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={previewAlt || t('common.photoPreview', { defaultValue: 'Photo' })}
              onClick={(e) => e.stopPropagation()}
              sx={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 2,
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.35)',
                bgcolor: '#fff',
              }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pt: 1.5, pb: 0, gap: 1 }} onClick={(e) => e.stopPropagation()}>
          {previewUrl ? (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => {
                const named = previewAlt && /\.\w{2,4}$/.test(previewAlt) ? previewAlt : undefined;
                void downloadUploadFile(previewSourcePath || previewUrl, named);
              }}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: '#fff' }}
            >
              {t('common.download', { defaultValue: 'Download' })}
            </Button>
          ) : null}
          <Button
            variant="contained"
            disableElevation
            onClick={closePhotoPreview}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </DialogActions>
      </Dialog>
    </PhotoPreviewContext.Provider>
  );
};

export default PhotoPreviewProvider;
