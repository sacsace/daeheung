import { useLayoutEffect } from 'react';
import { isScrollHoldActive, restoreHeldScrollNow } from '../../utils/preserveScroll';

/**
 * holdScrollPosition 활성 구간에서 레이아웃 커밋 직후 스크롤을 맞춘다.
 * App 루트에 마운트해 두면 전 페이지 수정/삭제 리렌더에 적용된다.
 */
export default function ScrollPreserveBridge() {
  useLayoutEffect(() => {
    if (isScrollHoldActive()) {
      restoreHeldScrollNow();
    }
  });

  return null;
}
