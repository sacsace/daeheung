/** 전자결재 상태 변경 → 급여관리 등 다른 화면이 리프레시 없이 동기화 */

export const APPROVAL_CHANGED_EVENT = 'mvs-approval-changed';
const STORAGE_KEY = 'mvs-approval-changed';
const CHANNEL_NAME = 'mvs-approval-changed';

export type ApprovalChangedDetail = {
  approvalId?: number;
  documentId?: string;
  status?: string;
  type?: string;
};

export function notifyApprovalStatusChanged(detail: ApprovalChangedDetail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(APPROVAL_CHANGED_EVENT, { detail }));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ t: Date.now(), ...detail })
    );
  } catch {
    /* ignore */
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(detail);
    channel.close();
  } catch {
    /* ignore */
  }
}

/** 같은 탭·다른 탭·포커스 복귀 시 콜백. 정리 함수 반환 */
export function subscribeApprovalStatusChanged(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleCustom = () => onChange();
  const handleFocus = () => onChange();
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };

  window.addEventListener(APPROVAL_CHANGED_EVENT, handleCustom);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => onChange();
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener(APPROVAL_CHANGED_EVENT, handleCustom);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('storage', handleStorage);
    try {
      channel?.close();
    } catch {
      /* ignore */
    }
  };
}
