/** 테이블·컬럼·릴레이션 미존재 등 DB 스키마 미비 오류 */
export const isMissingTableError = (error: unknown): boolean => {
  const err = error as {
    name?: string;
    message?: string;
    parent?: { message?: string; code?: string };
    original?: { code?: string; message?: string };
  };
  const message = String(
    err?.message || err?.parent?.message || err?.original?.message || ''
  );
  const code = err?.parent?.code || err?.original?.code;

  return (
    err?.name === 'SequelizeDatabaseError' &&
    (code === '42P01' ||
      code === '42703' ||
      message.includes('relation') ||
      message.includes('does not exist') ||
      message.includes('릴레이션') ||
      message.includes('존재하지'))
  );
};
