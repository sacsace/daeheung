/**
 * 수정·삭제 등 DOM이 잠시 접힐 때 스크롤이 맨 위로 튀는 것을 막는다.
 * window + document + [data-app-scroll-root] 컨테이너를 함께 복원한다.
 */

type ScrollTarget = Window | Element;

type ScrollSnapshot = {
  target: ScrollTarget;
  top: number;
  left: number;
};

const SCROLL_ROOT_SELECTOR = '[data-app-scroll-root]';

let holdUntil = 0;
let snapshots: ScrollSnapshot[] = [];
let rafId = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let mutationObserver: MutationObserver | null = null;
let userScrollCancelAttached = false;

const isWindow = (target: ScrollTarget): target is Window =>
  typeof Window !== 'undefined' && target === window;

const readScroll = (target: ScrollTarget): { top: number; left: number } => {
  if (isWindow(target)) {
    return {
      top: window.scrollY || document.documentElement.scrollTop || 0,
      left: window.scrollX || document.documentElement.scrollLeft || 0,
    };
  }
  return { top: target.scrollTop, left: target.scrollLeft };
};

const writeScroll = (target: ScrollTarget, top: number, left: number) => {
  if (isWindow(target)) {
    window.scrollTo(left, top);
    if (document.documentElement) {
      document.documentElement.scrollTop = top;
      document.documentElement.scrollLeft = left;
    }
    if (document.body) {
      document.body.scrollTop = top;
      document.body.scrollLeft = left;
    }
    return;
  }
  target.scrollTop = top;
  target.scrollLeft = left;
};

const collectSnapshots = (): ScrollSnapshot[] => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];
  const list: ScrollSnapshot[] = [];
  const win = readScroll(window);
  list.push({ target: window, top: win.top, left: win.left });

  const scrolling = document.scrollingElement;
  if (scrolling && scrolling !== document.body) {
    list.push({
      target: scrolling,
      top: scrolling.scrollTop,
      left: scrolling.scrollLeft,
    });
  }

  document.querySelectorAll(SCROLL_ROOT_SELECTOR).forEach((el) => {
    list.push({
      target: el,
      top: el.scrollTop,
      left: el.scrollLeft,
    });
  });

  return list;
};

const restoreSnapshots = () => {
  for (const snap of snapshots) {
    try {
      const current = readScroll(snap.target);
      // 위로 튄 경우만 복원 — 사용자가 아래로 스크롤한 값은 유지
      if (current.top < snap.top - 4 || Math.abs(current.left - snap.left) > 4) {
        writeScroll(snap.target, snap.top, snap.left);
      } else if (current.top > snap.top + 4) {
        snap.top = current.top;
        snap.left = current.left;
      }
    } catch {
      /* ignore detached nodes */
    }
  }
};

const stopHold = () => {
  holdUntil = 0;
  snapshots = [];
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
};

const onUserScrollIntent = () => {
  if (Date.now() < holdUntil) {
    // 의도적 스크롤이면 스냅샷을 현재 위치로 갱신
    snapshots = collectSnapshots();
  }
};

const ensureUserScrollListeners = () => {
  if (userScrollCancelAttached || typeof window === 'undefined') return;
  userScrollCancelAttached = true;
  const opts = { passive: true, capture: true } as const;
  window.addEventListener('wheel', onUserScrollIntent, opts);
  window.addEventListener('touchmove', onUserScrollIntent, opts);
};

const tick = () => {
  if (Date.now() >= holdUntil) {
    stopHold();
    return;
  }
  restoreSnapshots();
  rafId = requestAnimationFrame(tick);
};

/** 현재 스크롤을 잠깐 고정·복원한다 (수정/삭제 API 직후 React 리렌더 대비) */
export const holdScrollPosition = (durationMs = 900): void => {
  if (typeof window === 'undefined') return;
  ensureUserScrollListeners();
  snapshots = collectSnapshots();
  holdUntil = Math.max(holdUntil, Date.now() + durationMs);

  if (!rafId) {
    rafId = requestAnimationFrame(tick);
  }
  if (intervalId == null) {
    intervalId = setInterval(() => {
      if (Date.now() >= holdUntil) {
        stopHold();
        return;
      }
      restoreSnapshots();
    }, 50);
  }
  if (!mutationObserver && typeof MutationObserver !== 'undefined' && document.body) {
    mutationObserver = new MutationObserver(() => {
      if (Date.now() < holdUntil) restoreSnapshots();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
};

/** hold 중이면 유지 시간을 연장 (삭제 후 목록 GET 등) */
export const extendScrollHold = (extraMs = 500): void => {
  if (Date.now() < holdUntil) {
    holdUntil = Math.max(holdUntil, Date.now() + extraMs);
    return;
  }
};

export const isScrollHoldActive = (): boolean => Date.now() < holdUntil;

/** hold 중이면 즉시 스냅샷 위치로 복원 (useLayoutEffect용) */
export const restoreHeldScrollNow = (): void => {
  if (Date.now() >= holdUntil) return;
  restoreSnapshots();
};

/** 동기 작업 전후로 스크롤을 캡처·복원 */
export const preserveScrollAround = <T>(fn: () => T): T => {
  const snaps = collectSnapshots();
  try {
    return fn();
  } finally {
    requestAnimationFrame(() => {
      for (const snap of snaps) {
        try {
          writeScroll(snap.target, snap.top, snap.left);
        } catch {
          /* ignore */
        }
      }
    });
    holdScrollPosition(400);
  }
};
