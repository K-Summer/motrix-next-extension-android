/**
 * @fileoverview Download link detection for DOM-level interception.
 *
 * On Firefox Android, the browser.downloads API is not available. This module
 * detects "downloadable" links at the DOM level so the content script can
 * intercept them before the browser navigates away.
 *
 * Detection heuristics:
 *   1. Links with the HTML `download` attribute
 *   2. Links to URLs with known downloadable file extensions
 *   3. Links to magnet / ed2k / thunder protocol URLs
 */

const DOWNLOADABLE_EXTENSIONS = new Set([
  '7z',
  'apk',
  'arj',
  'avi',
  'bin',
  'bz2',
  'cab',
  'chm',
  'crx',
  'csv',
  'deb',
  'dmg',
  'doc',
  'docx',
  'epub',
  'exe',
  'flac',
  'flv',
  'gif',
  'gz',
  'img',
  'iso',
  'jar',
  'jpeg',
  'jpg',
  'lz',
  'lzh',
  'mkv',
  'mov',
  'mp3',
  'mp4',
  'mpg',
  'mpeg',
  'msi',
  'odp',
  'ods',
  'odt',
  'ogg',
  'ogv',
  'pdf',
  'pkg',
  'png',
  'ppt',
  'pptx',
  'psd',
  'rar',
  'rpm',
  'rtf',
  'svg',
  'swf',
  'tar',
  'tbz2',
  'tgz',
  'torrent',
  'ttf',
  'txt',
  'vob',
  'wav',
  'webm',
  'webp',
  'wmv',
  'xls',
  'xlsx',
  'xz',
  'zip',
  'zst',
]);

const EXCLUDED_EXTENSIONS = new Set([
  'asp',
  'aspx',
  'cgi',
  'css',
  'htm',
  'html',
  'jsp',
  'js',
  'json',
  'jspx',
  'php',
  'rb',
  'shtml',
  'wasm',
  'xml',
  'xhtml',
]);

const EXTERNAL_PROTOCOLS = ['magnet:', 'ed2k:', 'thunder:'] as const;

function extensionFromPath(pathname: string): string {
  const lastSlash = pathname.lastIndexOf('/');
  const filename = pathname.slice(lastSlash + 1);
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

function hasDownloadableExtension(href: string): boolean {
  try {
    const url = new URL(href);
    const ext = extensionFromPath(url.pathname);
    if (!ext) return false;
    if (EXCLUDED_EXTENSIONS.has(ext)) return false;
    return DOWNLOADABLE_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function hasDownloadAttribute(element: Element): boolean {
  const anchor = element.closest('a');
  if (!anchor) return false;
  return anchor.hasAttribute('download');
}

function isExternalProtocol(href: string): boolean {
  return EXTERNAL_PROTOCOLS.some((protocol) => href.startsWith(protocol));
}

export interface DetectedLink {
  url: string;
  /** How the link was detected: 'download-attr', 'extension', 'protocol' */
  reason: 'download-attr' | 'extension' | 'protocol';
}

/**
 * Check whether a link element is a candidate for download interception.
 * Returns the detected link info, or null if the link should not be intercepted.
 */
export function detectDownloadLink(element: Element): DetectedLink | null {
  const anchor = element.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return null;

  const href = anchor.getAttribute('href');
  if (!href) return null;

  if (href.startsWith('#')) return null;
  if (href.startsWith('javascript:')) return null;
  if (href.startsWith('mailto:')) return null;
  if (href.startsWith('data:')) return null;

  if (hasDownloadAttribute(element)) {
    return { url: anchor.href, reason: 'download-attr' };
  }

  if (isExternalProtocol(href)) {
    return { url: href, reason: 'protocol' };
  }

  if (hasDownloadableExtension(anchor.href)) {
    return { url: anchor.href, reason: 'extension' };
  }

  return null;
}

/**
 * Check whether a link should be intercepted based on user settings.
 */
export function shouldInterceptLink(
  detected: DetectedLink,
  enabled: boolean,
  interceptionScope: { browserDownloads: boolean; magnet: boolean; ed2k: boolean; thunder: boolean },
): boolean {
  if (!enabled) return false;

  if (detected.reason === 'protocol') {
    const protocol = detected.url.split(':')[0] as 'magnet' | 'ed2k' | 'thunder';
    return interceptionScope[protocol] ?? false;
  }

  return interceptionScope.browserDownloads;
}