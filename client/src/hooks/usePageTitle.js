import { useEffect } from 'react';

/**
 * Updates the document title reactively.
 * @param {string} title Page specific title or null
 */
export function usePageTitle(title) {
  useEffect(() => {
    const defaultTitle = "Akazi · Jobs in Rwanda | Imirimo n'Akazi mu Rwanda";
    if (title && title.trim()) {
      document.title = `${title.trim()} · Akazi`;
    } else {
      document.title = defaultTitle;
    }
  }, [title]);
}
