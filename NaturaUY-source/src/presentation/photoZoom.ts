/** Bounds in viewport pixels for a centered image rendered with contentFit=contain. */
export function photoZoomBounds(width: number, height: number, aspectRatio: number, scale: number): { x: number; y: number } {
  'worklet';
  if (width <= 0 || height <= 0 || scale <= 1) return { x: 0, y: 0 };
  const ratio = aspectRatio > 0 ? aspectRatio : width / height;
  const imageWidth = Math.min(width, height * ratio);
  const imageHeight = Math.min(height, width / ratio);
  return { x: Math.max(0, (imageWidth * scale - width) / 2), y: Math.max(0, (imageHeight * scale - height) / 2) };
}

export function clampPhotoOffset(offset: number, limit: number): number {
  'worklet';
  return Math.max(-limit, Math.min(limit, offset));
}
