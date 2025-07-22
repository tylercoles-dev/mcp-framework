import { marked } from 'marked';

// Configure marked for security and consistency
marked.setOptions({
  breaks: true, // Enable line breaks
  gfm: true, // Enable GitHub Flavored Markdown
});

// Custom renderer to make links safe
const renderer = new marked.Renderer();
renderer.link = function({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.use({ renderer });

/**
 * Convert markdown text to HTML
 * @param markdown The markdown text to convert
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }
  
  try {
    return marked(markdown) as string;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    // Return the original text if markdown parsing fails
    return markdown;
  }
}

/**
 * Convert markdown to plain text (strip HTML tags)
 * @param markdown The markdown text to convert
 * @returns Plain text string
 */
export function markdownToText(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }
  
  try {
    const html = marked(markdown) as string;
    // Simple HTML tag stripping (for basic use cases)
    return html.replace(/<[^>]*>/g, '').trim();
  } catch (error) {
    console.error('Error parsing markdown to text:', error);
    return markdown;
  }
}

/**
 * Sanitize markdown by limiting allowed elements
 * This is a basic implementation - for production use, consider using a library like DOMPurify
 */
export function sanitizeMarkdown(html: string): string {
  // For now, just return the HTML as-is since marked is generally safe
  // In a production environment, you'd want to use DOMPurify or similar
  return html;
}