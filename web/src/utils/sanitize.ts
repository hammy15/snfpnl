import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML string to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h3', 'h4', 'strong', 'em', 'li', 'ul', 'ol', 'br', 'p', 'span'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
  }) as string;
}

/**
 * Converts simple markdown to sanitized HTML
 * Supports: ## headings, ### subheadings, **bold**, bullet points
 */
export function formatMarkdownSafe(text: string): string {
  if (!text) return '';

  const html = text
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/### (.*)/g, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/• (.*)/g, '<li>$1</li>')
    .replace(/\n/g, '<br/>');

  return sanitizeHtml(html);
}
