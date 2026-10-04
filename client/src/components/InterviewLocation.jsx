import { ExternalLink } from 'lucide-react';

export default function InterviewLocation({ value, fallback }) {
  const text = String(value || '').trim();
  if (!text) return <span>{fallback}</span>;

  let href = null;
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href;
  } catch {
    // Non-URL locations remain plain text.
  }

  if (!href) return <span className="break-words">{text}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 max-w-full items-start gap-1.5 font-semibold text-blue-700 hover:underline"
    >
      <span className="min-w-0 break-all">{text}</span>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}