export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Temporarily Interrupted · TixNaija</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#09090b" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif;
        background: #09090b;
        color: #f4f4f5;
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        position: relative;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
      }
      .ambient-glow {
        position: absolute;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 480px;
        height: 320px;
        background: radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, rgba(234, 88, 12, 0) 70%);
        pointer-events: none;
        z-index: 0;
      }
      .card {
        position: relative;
        z-index: 1;
        max-width: 28rem;
        width: 100%;
        background: rgba(24, 24, 27, 0.72);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.5rem;
        padding: 2.5rem 2rem;
        text-align: center;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04);
      }
      .icon-container {
        margin: 0 auto 1.5rem;
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 9999px;
        background: rgba(234, 88, 12, 0.12);
        border: 1px solid rgba(234, 88, 12, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .icon {
        width: 1.75rem;
        height: 1.75rem;
        color: #f97316;
      }
      h1 {
        font-size: 1.5rem;
        font-weight: 600;
        letter-spacing: -0.025em;
        line-height: 1.25;
        color: #ffffff;
        margin-bottom: 0.625rem;
      }
      p {
        color: #a1a1aa;
        font-size: 0.875rem;
        line-height: 1.55;
        margin-bottom: 1.75rem;
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      @media (min-width: 480px) {
        .actions { flex-direction: row; }
      }
      a, button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2.75rem;
        padding: 0 1.25rem;
        border-radius: 0.875rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
        flex: 1;
      }
      button:active, a:active {
        transform: scale(0.97);
      }
      .btn-primary {
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: #ffffff;
        border: none;
        box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
      }
      .btn-primary:hover { opacity: 0.94; }
      .btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        color: #f4f4f5;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .btn-secondary:hover { background: rgba(255, 255, 255, 0.08); }
      .brand {
        margin-top: 2rem;
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.25);
        font-weight: 700;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="ambient-glow"></div>
    <div class="card">
      <div class="icon-container">
        <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.007M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1>Page Interrupted</h1>
      <p>Your session and tickets are completely secure. A quick refresh usually restores the page immediately.</p>
      <div class="actions">
        <button class="btn-primary" onclick="location.reload()">Refresh page</button>
        <a class="btn-secondary" href="/">Return home</a>
      </div>
      <div class="brand">TixNaija</div>
    </div>
  </body>
</html>`;
}
