/**
 * Browser-only helper: downscale a selected image file to a bounded JPEG and
 * return both the base64 (for the estimate API) and a Blob (for upload).
 * Keeping photos small controls upload size and vision-token cost.
 *
 * Canvas glue — excluded from coverage (see vitest.config.ts); the component
 * that uses it is tested with this module mocked.
 */

const MAX_EDGE = 1024
const JPEG_QUALITY = 0.82

export interface ProcessedImage {
  /** Base64 (no data: prefix) for the estimate API. */
  base64: string
  /** The re-encoded JPEG bytes for storage upload. */
  blob: Blob
  mediaType: "image/jpeg"
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    img.src = url
  })
}

export async function fileToProcessedImage(file: File): Promise<ProcessedImage> {
  const img = await loadImage(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  })

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)

  return { base64, blob, mediaType: "image/jpeg" }
}
