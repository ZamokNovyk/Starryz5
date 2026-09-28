import html2canvas from 'html2canvas';

export async function captureScreenCanvas(): Promise<HTMLCanvasElement> {
  const w = window.innerWidth;
  const h = window.innerHeight;

  try {
    const rootEl = document.getElementById('root') || document.body;

    const promise = html2canvas(rootEl, {
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      x: 0,
      y: window.scrollY || 0,
      scale: Math.min(window.devicePixelRatio || 1, 1),
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      ignoreElements: (el) => {
        return (
          el.id === 'canvasContainer' ||
          el.getAttribute('aria-hidden') === 'true' ||
          el.classList?.contains('pointer-events-none') ||
          el.classList?.contains('z-[99999]') ||
          el.classList?.contains('z-[99990]')
        );
      },
    });

    // Fast safety timeout of 220ms so page change is instantaneous
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 220)
    );

    const canvas = await Promise.race([promise, timeoutPromise]);
    if (canvas && canvas.width > 20 && canvas.height > 20) {
      return canvas;
    }
  } catch (err) {
    console.warn('html2canvas capture skipped, using visual fallback:', err);
  }

  // Fallback: capture current theme background and layout styles
  const fallback = document.createElement('canvas');
  fallback.width = w;
  fallback.height = h;
  const ctx = fallback.getContext('2d');
  if (ctx) {
    const bodyBg = window.getComputedStyle(document.body).backgroundColor || '#09090b';
    ctx.fillStyle = bodyBg;
    ctx.fillRect(0, 0, w, h);

    const header = document.querySelector('header');
    if (header) {
      const rect = header.getBoundingClientRect();
      const headerBg = window.getComputedStyle(header).backgroundColor || '#111113';
      ctx.fillStyle = headerBg;
      ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    }
  }
  return fallback;
}
