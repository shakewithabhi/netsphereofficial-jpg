import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  Presentation,
  File,
} from 'lucide-react';

interface FileIconProps {
  mimeType: string;
  size?: number;
  className?: string;
}

export function FileIcon({ mimeType, size = 24, className = '' }: FileIconProps) {
  const props = { size, className };

  if (mimeType.startsWith('image/')) {
    return <FileImage {...props} className={`text-violet-500 ${className}`} />;
  }
  if (mimeType.startsWith('video/')) {
    return <FileVideo {...props} className={`text-red-500 ${className}`} />;
  }
  if (mimeType.startsWith('audio/')) {
    return <FileAudio {...props} className={`text-pink-500 ${className}`} />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText {...props} className={`text-red-600 ${className}`} />;
  }
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed' ||
    mimeType === 'application/x-rar-compressed' ||
    mimeType === 'application/x-tar' ||
    mimeType === 'application/gzip'
  ) {
    return <FileArchive {...props} className={`text-yellow-600 ${className}`} />;
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType === 'text/csv' ||
    mimeType.includes('excel')
  ) {
    return <FileSpreadsheet {...props} className={`text-green-600 ${className}`} />;
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return <Presentation {...props} className={`text-orange-500 ${className}`} />;
  }
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  ) {
    return <FileCode {...props} className={`text-cyan-500 ${className}`} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText {...props} className={`text-blue-600 ${className}`} />;
  }

  return <File {...props} className={`text-slate-400 ${className}`} />;
}
