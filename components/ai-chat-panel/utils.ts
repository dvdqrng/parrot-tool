import { ContentPart } from './types';

/**
 * Parse message content to extract draft sections
 */
export function parseMessageContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const draftRegex = /<draft>([\s\S]*?)<\/draft>/g;
  let lastIndex = 0;
  let match;

  while ((match = draftRegex.exec(content)) !== null) {
    // Add text before the draft
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        parts.push({ type: 'text', content: text });
      }
    }
    // Add the draft
    parts.push({ type: 'draft', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last draft
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      parts.push({ type: 'text', content: text });
    }
  }

  // If no drafts found, return the whole content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return parts;
}
