/**
 * Client-side canvas image compression utility.
 * Adheres to rule 31: compress images before upload; never upload original phone photos.
 */

interface CompressionOptions {
  maxSide?: number;
  initialQuality?: number;
  fallbackQuality?: number;
  maxSizeBytes?: number;
  preferredType?: 'image/webp' | 'image/jpeg';
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const {
    maxSide = 1600,
    initialQuality = 0.8,
    fallbackQuality = 0.5,
    maxSizeBytes = 5 * 1024 * 1024,
    preferredType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    // If not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let w = img.width;
      let h = img.height;

      if (w > maxSide || h > maxSide) {
        const ratio = Math.min(maxSide / w, maxSide / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context is not available for image compression.'));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);

      const exportBlob = (type: string, quality: number): Promise<Blob | null> =>
        new Promise((res) => canvas.toBlob((b) => res(b), type, quality));

      (async () => {
        try {
          // 1. Try preferred format with initial quality
          let blob = await exportBlob(preferredType, initialQuality);

          // If preferred format is not supported or failed, fallback to JPEG
          if (!blob || (preferredType === 'image/webp' && blob.type !== 'image/webp')) {
            blob = await exportBlob('image/jpeg', initialQuality);
          }

          if (blob && blob.size <= maxSizeBytes) {
            const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
            resolve({ blob, mimeType: blob.type, extension: ext });
            return;
          }

          // 2. Retry with lower quality if oversized
          const targetType = blob?.type || 'image/jpeg';
          blob = await exportBlob(targetType, fallbackQuality);

          if (blob && blob.size <= maxSizeBytes) {
            const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
            resolve({ blob, mimeType: blob.type, extension: ext });
            return;
          }

          reject(
            new Error(
              `Image is too large (${Math.round(
                (blob?.size || file.size) / (1024 * 1024)
              )} MB) and could not be compressed below ${Math.round(
                maxSizeBytes / (1024 * 1024)
              )} MB.`
            )
          );
        } catch (err: unknown) {
          reject(err instanceof Error ? err : new Error('Failed to compress image.'));
        }
      })();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression. The file may be corrupt.'));
    };

    img.src = objectUrl;
  });
}
