/** PWA·홈 화면 추가로 설치된 앱에서 실행 중인지 확인 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  return false;
}
