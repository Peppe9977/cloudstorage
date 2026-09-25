const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'ogv'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
const TEXT_EXT = [
  'txt', 'md', 'json', 'csv', 'log', 'js', 'jsx', 'ts', 'tsx', 'css',
  'html', 'yml', 'yaml', 'py', 'sh', 'xml', 'env'
];

/**
 * Returns which kind of inline preview a file supports, based on its
 * extension: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other'.
 * 'other' covers things browsers can't natively render (docx, xlsx, zip...),
 * which fall back to download-only.
 */
export function getFileKind(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (TEXT_EXT.includes(ext)) return 'text';
  return 'other';
}
