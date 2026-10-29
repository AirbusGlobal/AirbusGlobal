/**
 * YouTube and YouTube Shorts parser utility for AirBus
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const str = url.trim();

  // Pattern 1: YouTube Shorts -> https://(www.)youtube.com/shorts/VIDEO_ID
  const shortsMatch = str.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // Pattern 2: Standard watch -> https://(www.)youtube.com/watch?v=VIDEO_ID
  const watchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  // Pattern 3: Short link -> https://youtu.be/VIDEO_ID
  const youtuBeMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch && youtuBeMatch[1]) return youtuBeMatch[1];

  // Pattern 4: Embed -> https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = str.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];

  // Pattern 5: Bare ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function getYouTubeEmbedUrl(id: string, autoplay: boolean = true): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
}

export function getYouTubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
