import fs from 'fs';
import path from 'path';

const isEphemeralTmpPath = (raw: string): boolean => {
  const normalized = path.resolve(raw).replace(/\\/g, '/').toLowerCase();
  return (
    normalized === '/tmp' ||
    normalized.startsWith('/tmp/') ||
    normalized.endsWith('/tmp') ||
    /\/tmp\/uploads\/?$/.test(normalized)
  );
};

const isOnRailway = (): boolean =>
  Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );

/**
 * 업로드 파일 디스크 루트.
 * 공개 URL은 계속 `/uploads/...` 이고, 디스크만 영구 볼륨/로컬 경로로 해석한다.
 *
 * 우선순위:
 * 1) Railway Volume 마운트 (`RAILWAY_VOLUME_MOUNT_PATH`)
 * 2) `UPLOAD_PATH` (단, `/tmp/...` 는 Railway에서 무시 — 재배포 시 삭제됨)
 * 3) 로컬/기본: `<cwd>/uploads`
 */
export function getUploadRoot(): string {
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  const explicit = process.env.UPLOAD_PATH?.trim();

  if (railwayMount) {
    if (explicit && path.isAbsolute(explicit) && !isEphemeralTmpPath(explicit)) {
      const resolved = path.resolve(explicit);
      const mount = path.resolve(railwayMount);
      if (resolved === mount || resolved.startsWith(mount + path.sep)) {
        return resolved;
      }
    }
    return path.resolve(railwayMount);
  }

  if (explicit && !isEphemeralTmpPath(explicit)) {
    return path.resolve(explicit);
  }

  // Railway인데 볼륨 미연결 + /tmp 설정인 경우라도 컨테이너 앱 경로에 기록
  // (볼륨을 /app/uploads 에 마운트하면 이 경로가 영속화됨)
  if (isOnRailway()) {
    return path.resolve('/app/uploads');
  }

  return path.resolve(process.cwd(), 'uploads');
}

export function ensureUploadRoot(): string {
  const root = getUploadRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** 하위 폴더를 만들고 절대 경로를 반환 */
export function ensureUploadSubdir(...parts: string[]): string {
  const dir = path.join(getUploadRoot(), ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * DB에 저장된 pdf_path / pdf_url 로 실제 파일 경로 해석.
 * 절대경로가 없거나(재배포·다른 머신) 깨진 경우 `/uploads/...` URL로 재해석한다.
 */
export function resolveStoredUploadFile(
  pdfPath?: string | null,
  pdfUrl?: string | null
): string | null {
  const stored = String(pdfPath || '').trim();
  if (stored && fs.existsSync(stored)) return stored;

  const url = String(pdfUrl || '').trim().replace(/\\/g, '/');
  if (url.startsWith('/uploads/')) {
    const rel = url.slice('/uploads/'.length);
    const candidate = path.join(getUploadRoot(), ...rel.split('/').filter(Boolean));
    if (fs.existsSync(candidate)) return candidate;
  }

  // 예전 절대경로 끝부분(payslips/...)만 남아 있는 경우
  if (stored) {
    const normalized = stored.replace(/\\/g, '/');
    const marker = '/uploads/';
    const idx = normalized.toLowerCase().lastIndexOf(marker);
    if (idx >= 0) {
      const rel = normalized.slice(idx + marker.length);
      const candidate = path.join(getUploadRoot(), ...rel.split('/').filter(Boolean));
      if (fs.existsSync(candidate)) return candidate;
    }
    const payslipIdx = normalized.toLowerCase().lastIndexOf('/payslips/');
    if (payslipIdx >= 0) {
      const rel = normalized.slice(payslipIdx + 1); // payslips/...
      const candidate = path.join(getUploadRoot(), ...rel.split('/').filter(Boolean));
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}
