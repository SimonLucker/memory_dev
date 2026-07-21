// Shared photo intake: phone camera shots arrive as 4000px HEIC/JPEG monsters.
// Re-encode through a canvas — bounded JPEG (browser applies EXIF rotation while
// drawing), small enough to travel as a data URL and upload quickly.
// → Promise<dataUrl> (raw file as fallback when the browser can't decode it).
export function encodePhoto(file, maxDim = 1600, quality = 0.85) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    }
    img.src = url
  })
}
