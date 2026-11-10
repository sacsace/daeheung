import { useCallback, useEffect, useState } from 'react';
import { isAppInstalled } from '../utils/isAppInstalled';
import { isIOSDevice } from '../utils/isMobileOrTablet';

const DISMISS_SESSION_KEY = 'mvs-app-install-banner-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function useAppInstallPrompt(enabled: boolean) {
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_SESSION_KEY) === '1'
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useEffect(() => {
    if (!enabled || installed) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [enabled, installed]);

  useEffect(() => {
    if (isAppInstalled()) {
      setInstalled(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    const androidUrl = process.env.REACT_APP_ANDROID_APP_URL?.trim();
    const iosUrl = process.env.REACT_APP_IOS_APP_URL?.trim();

    if (/Android/i.test(navigator.userAgent)) {
      if (androidUrl) {
        window.open(androidUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    if (isIOSDevice()) {
      if (iosUrl) {
        window.open(iosUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      setIosGuideOpen(true);
      return;
    }

    setIosGuideOpen(true);
  }, [deferredPrompt]);

  const closeIosGuide = useCallback(() => setIosGuideOpen(false), []);

  const shouldShow = enabled && !installed && !dismissed;

  return {
    shouldShow,
    installed,
    canPromptInstall: Boolean(deferredPrompt),
    iosGuideOpen,
    install,
    dismiss,
    closeIosGuide,
  };
}
