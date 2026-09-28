import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['a', 'b', 'br', 'em', 'h2', 'h3', 'h4', 'li', 'ol', 'p', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'];
const ALLOWED_ATTR = ['colspan', 'href', 'rel', 'rowspan', 'target'];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function sanitizeCatalogHtml(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const html = /<\/?[a-z][^>]*>/i.test(raw)
    ? raw.replace(/<h1\b/gi, '<h2').replace(/<\/h1>/gi, '</h2>')
    : `<p>${escapeHtml(raw).replace(/\r?\n/g, '<br>')}</p>`;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
