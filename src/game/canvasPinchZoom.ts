/**
 * Zoom pincement 2 doigts sur le canvas (mobile / tablette).
 * `zoomAtScreen` attend des coordonnées en pixels canvas (comme la molette Ctrl).
 */
export function bindCanvasPinchZoom(
  canvas: HTMLCanvasElement,
  zoomAtScreen: (canvasPxX: number, canvasPxY: number, factor: number) => void,
): () => void {
  function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  let pinchDist: number | null = null;

  const onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      const a = e.touches.item(0)!;
      const b = e.touches.item(1)!;
      pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  };

  const onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 2 || pinchDist === null || pinchDist < 8) return;
    e.preventDefault();
    const a = e.touches.item(0)!;
    const b = e.touches.item(1)!;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (d < 8) return;
    const factor = d / pinchDist;
    pinchDist = d;
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const { x, y } = clientToCanvas(midX, midY);
    zoomAtScreen(x, y, factor);
  };

  const onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) pinchDist = null;
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

  return (): void => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
  };
}
