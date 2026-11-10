import React, { useEffect, useState } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { getApiOrigin, getUploadUrl } from '../../utils/uploadUrl';
import { getAuthTokenFromStorage } from '../../services/api/client';

type AuthMediaProps = {
  src?: string | null;
  alt?: string;
  sx?: SxProps<Theme>;
  style?: React.CSSProperties;
  className?: string;
  onError?: React.ReactEventHandler<HTMLImageElement>;
};

function isInlineOrAbsoluteMedia(src: string): boolean {
  return (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://')
  );
}

/**
 * 인증이 필요한 /uploads 이미지를 Authorization 헤더로 받아 blob URL로 표시.
 * 쿼리 access_token 방식은 긴 JWT·프록시에서 깨질 수 있어 운영에서 불안정함.
 */
const AuthMedia: React.FC<AuthMediaProps> = ({ src, alt = '', sx, style, className, onError }) => {
  const [objectUrl, setObjectUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = '';

    const load = async () => {
      setFailed(false);
      setObjectUrl('');

      const raw = String(src || '').trim();
      if (!raw) return;

      if (raw.startsWith('data:') || raw.startsWith('blob:')) {
        if (!cancelled) setObjectUrl(raw);
        return;
      }

      const token = getAuthTokenFromStorage();
      const absolute =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? raw.split('?')[0]
          : `${getApiOrigin()}${
              raw.startsWith('/uploads/')
                ? raw
                : `/uploads/${raw.replace(/^\/+/, '')}`
            }`;

      // 외부 절대 URL(토큰 불필요)은 그대로 사용
      if (isInlineOrAbsoluteMedia(raw) && !raw.includes('/uploads/')) {
        if (!cancelled) setObjectUrl(raw);
        return;
      }

      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(absolute, {
          headers,
          credentials: 'include',
          cache: 'force-cache',
        });
        if (!res.ok) throw new Error(`media ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      } catch {
        // 폴백: 쿼리 토큰 URL (구형 프록시·직접 링크)
        if (!cancelled) {
          setObjectUrl(getUploadUrl(raw));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (!src || failed) return null;
  if (!objectUrl) {
    return (
      <Box
        className={className}
        sx={{
          ...((sx as object) || {}),
          bgcolor: '#F1F5F9',
          minHeight: 24,
        }}
        style={style}
        aria-hidden
      />
    );
  }

  return (
    <Box
      component="img"
      src={objectUrl}
      alt={alt}
      data-photo-preview={objectUrl}
      data-photo-preview-alt={alt}
      data-photo-preview-src={String(src || '')}
      sx={sx}
      style={style}
      className={className}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
};

export default AuthMedia;
