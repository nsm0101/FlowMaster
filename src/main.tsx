import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/**
 * Remove the static splash screen rendered in index.html. The splash lives inside
 * #root and is only meant to cover the gap before React mounts; if it is ever left
 * behind (e.g. a render error) the app looks like it "never initializes", so we
 * always take it down explicitly once we have a result to show.
 */
function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.style.pointerEvents = 'none';
  window.setTimeout(() => splash.remove(), 500);
}

/** Last-resort fallback shown if React cannot mount at all (e.g. a bad import). */
function renderFatalError(container: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,-apple-system,sans-serif;color:#12263a;background:#eef5f7">
      <div style="max-width:420px;width:100%;background:#fff;border:1px solid #d9e7ea;border-radius:18px;box-shadow:0 10px 26px rgba(18,57,52,.12);padding:28px;text-align:center">
        <div style="font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#9f1d1d">Could not start</div>
        <h2 style="margin:10px 0;color:#12263a">PEM FlowMaster failed to load</h2>
        <p style="color:#5f7077;line-height:1.45;margin:0 0 18px">${message.replace(/</g, '&lt;')}</p>
        <button onclick="window.location.reload()" style="border:0;background:#0072CE;color:#fff;font-weight:800;border-radius:12px;padding:12px 18px;cursor:pointer">Reload</button>
      </div>
    </div>`;
}

const container = document.getElementById('root');

if (!container) {
  // No mount point at all — surface it on the page instead of failing silently.
  document.body.innerHTML =
    '<p style="font-family:system-ui,sans-serif;padding:24px;color:#9f1d1d">PEM FlowMaster could not start: missing #root element.</p>';
} else {
  try {
    createRoot(container).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    dismissSplash();
  } catch (error) {
    console.error('PEM FlowMaster failed to mount:', error);
    renderFatalError(container, error);
  }
}
