const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
]);

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

export const SECURE_DOCUMENT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt';

export const SECURE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const lastDotIndex = normalized.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === normalized.length - 1) return '';
  return normalized.slice(lastDotIndex + 1);
}

function sanitizePathSegment(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'arquivo';
}

export function sanitizeStorageFilename(fileName: string) {
  const extension = getFileExtension(fileName);
  const baseName = extension ? fileName.slice(0, -(extension.length + 1)) : fileName;
  const safeBaseName = sanitizePathSegment(baseName);
  return extension ? `${safeBaseName}.${extension}` : safeBaseName;
}

export function buildSecureStoragePath(pathSegments: string[], fileName: string) {
  const safeSegments = pathSegments.map(sanitizePathSegment).filter(Boolean);
  return [...safeSegments, sanitizeStorageFilename(fileName)].join('/');
}

export function validateSecureDocument(file: File) {
  const extension = getFileExtension(file.name);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    return 'Use apenas PDF, imagens, Word, Excel, CSV ou TXT.';
  }

  if (file.size <= 0) {
    return 'O arquivo esta vazio.';
  }

  if (file.size > SECURE_DOCUMENT_MAX_BYTES) {
    return 'Cada arquivo deve ter no maximo 10 MB.';
  }

  if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return 'O tipo do arquivo nao e permitido para este envio.';
  }

  return null;
}

export function filterSecureDocuments(files: File[]) {
  const accepted: File[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    const error = validateSecureDocument(file);
    if (error) {
      rejected.push(`${file.name}: ${error}`);
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
