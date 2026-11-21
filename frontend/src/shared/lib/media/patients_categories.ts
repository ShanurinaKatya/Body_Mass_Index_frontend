const MINIO_PREFIX = 'http://localhost:9000/body-mass-index'

// Путь к файлу из public/ с учётом base (GitHub Pages: /Body_Mass_Index_frontend/).
export const publicUrl = (path: string): string =>
  import.meta.env.BASE_URL + path.replace(/^\//, '')

// Адрес объекта в MinIO заменяем на второй маршрут обратного прокси Vite,
// чтобы браузер не обращался к другому домену напрямую (CORS).
export const toMediaUrl = (url: string | null | undefined): string => {
  if (!url) {
    return ''
  }
  return url.replace(MINIO_PREFIX, '/s3')
}
