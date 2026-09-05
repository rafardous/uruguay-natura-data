const MAX_SIDE = 1600;

export async function prepareImageForUpload(file: File): Promise<File> {
  const { default: createPica } = await import('pica');
  const pica = createPica();
  if (file.type === 'image/heic' || file.type === 'image/heif') return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height;
    source.getContext('2d', { alpha: false })?.drawImage(bitmap, 0, 0);
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    await pica.resize(source, output, { quality: 3 });
    const blob = await pica.toBlob(output, 'image/webp', 0.8);
    const stem = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'imagen';
    return new File([blob], `${stem}-1600.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
