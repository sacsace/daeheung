import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { useErrorStore } from './store/errorStore';
import i18n, { bootstrapI18n } from './locales/i18n';

// Completely disable service worker in development only
if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
  // Unregister all existing service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });

  // Clear all caches
  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    });
  }
}

// 전역 에러 핸들러 설정
window.addEventListener('error', (event) => {
  const errorStore = useErrorStore.getState();
  let userMessage = i18n.t('common.pageLoadError');
  if (event.message) {
    if (event.message.includes('Cannot read property') || event.message.includes('Cannot read')) {
      userMessage = i18n.t('common.loadDataError');
    } else if (event.message.includes('Network') || event.message.includes('fetch')) {
      userMessage = i18n.t('common.networkErrorMsg');
    } else if (event.message.includes('TypeError')) {
      userMessage = i18n.t('common.unexpectedError');
    } else if (event.message.includes('ReferenceError')) {
      userMessage = i18n.t('common.pageLoadError');
    } else if (event.message.includes('SyntaxError') || event.message.includes('Unexpected token')) {
      userMessage = i18n.t('common.syntaxError');
    } else {
      userMessage = event.message;
    }
  }
  const errorDetails = process.env.NODE_ENV === 'development'
    ? `파일: ${event.filename}\n라인: ${event.lineno}\n컬럼: ${event.colno}\n\n에러: ${event.message}\n\n스택: ${event.error?.stack || 'N/A'}`
    : undefined;
  errorStore.showError(i18n.t('common.pageError'), userMessage, errorDetails, 'error');
  console.error('❌ [전역 에러 핸들러]', event);
});

// Promise rejection 핸들러
window.addEventListener('unhandledrejection', (event) => {
  const errorStore = useErrorStore.getState();
  let userMessage = i18n.t('common.processingError');
  if (event.reason) {
    if (typeof event.reason === 'string') {
      userMessage = event.reason;
    } else if (event.reason?.message) {
      userMessage = event.reason.message;
    } else if (event.reason?.response?.data?.message) {
      userMessage = event.reason.response.data.message;
    }
  }

  const errorDetails = process.env.NODE_ENV === 'development'
    ? `Promise Rejection: ${JSON.stringify(event.reason, null, 2)}`
    : undefined;

  errorStore.showError(
    i18n.t('common.pageError'),
    userMessage,
    errorDetails,
    'error'
  );

  console.error('❌ [전역 Promise Rejection 핸들러]', event.reason);
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

void bootstrapI18n().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  reportWebVitals();
});
