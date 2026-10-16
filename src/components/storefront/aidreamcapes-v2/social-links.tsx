import type { ReactNode } from "react";
import styles from "./social-links.module.css";

/** Public labels and destinations are supplied by current site navigation data. */
export type AidreamcapesSocialLink = {
  key: string;
  label: string;
  href: string;
};

const brandMarks: Record<string, ReactNode> = {
  facebook: <path d="M14.1 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5h1.7V3.1A22 22 0 0 0 15 3c-2.4 0-4 1.5-4 4.2v2.4H8.3v3.2H11V21z" />,
  instagram: <><rect fill="none" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" width="17" x="3.5" y="3.5" /><circle cx="12" cy="12" fill="none" r="4" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.7" r="1.1" /></>,
  pinterest: <path d="M12 2a10 10 0 0 0-3.6 19.3c0-.9 0-2 .2-2.8l1.3-5.5s-.3-.7-.3-1.6c0-1.5.9-2.7 2-2.7.9 0 1.3.7 1.3 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.6 2 1.7 2 2 0 3.5-2.2 3.5-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.5-5.4 5.2 0 1 .4 2.1.9 2.7l.2.5-.4 1.4c0 .2-.2.3-.5.2-1.4-.7-2.3-2.7-2.3-4.5 0-3.7 2.7-7.1 7.7-7.1 4 0 7.1 2.9 7.1 6.7 0 4-2.5 7.3-6 7.3-1.1 0-2.2-.6-2.6-1.3l-.7 2.7c-.2 1-1 2.2-1.4 3A10 10 0 1 0 12 2z" />,
  x: <path d="M18.9 3H22l-6.8 7.8L23 21h-6.2l-4.9-6.4L6.3 21H3.1l7.3-8.4L3 3h6.3l4.4 5.9zm-1.1 16.2h1.7L8.4 4.7H6.6z" />,
  youtube: <><path d="M21.6 7.1A3 3 0 0 0 19.5 5C17.7 4.5 12 4.5 12 4.5S6.3 4.5 4.5 5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.9A3 3 0 0 0 4.5 19c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.9z" /><path className={styles.cutout} d="m10 15.4 5.7-3.4L10 8.6z" /></>,
  tiktok: <path d="M16.5 2c.3 2.5 1.7 4 4.2 4.2v3.4a9 9 0 0 1-4.2-1.2v7.2a6.3 6.3 0 1 1-5.4-6.2V13a2.8 2.8 0 1 0 2 2.7V2z" />,
  reddit: <><path d="M21 11.8a2.3 2.3 0 1 0-3.9-1.7 13.6 13.6 0 0 0-4.3-1l.9-4.2 3 .6a1.7 1.7 0 1 0 .3-1.4l-3.6-.8a.7.7 0 0 0-.8.5l-1.1 5.3a13 13 0 0 0-4.6 1 2.3 2.3 0 1 0-3.9 1.7c-.3.6-.5 1.2-.5 1.9 0 3.2 4.3 5.9 9.5 5.9s9.5-2.7 9.5-5.9c0-.7-.2-1.3-.5-1.9z" /><circle className={styles.cutout} cx="8.4" cy="13.5" r="1.2" /><circle className={styles.cutout} cx="15.6" cy="13.5" r="1.2" /><path className={styles.smile} d="M8.5 16.4c1.8 1.2 5.2 1.2 7 0" /></>,
  whatsapp: <><path d="M20.5 3.5A11 11 0 0 0 3.2 16.8L1.8 22l5.4-1.4A11 11 0 0 0 20.5 3.5ZM12 20a8.7 8.7 0 0 1-4.5-1.2l-.3-.2-3.2.9.9-3.1-.2-.4A8.8 8.8 0 1 1 12 20Z" /><path d="M9.3 7.2c-.2-.5-.5-.5-.8-.5H8c-.3 0-.6.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 4.9 4.3 2.4.9 3 .7 3.6.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.1-1.4-.1-.2-.3-.2-.6-.4l-2-1c-.3-.1-.5-.2-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a7.6 7.6 0 0 1-3.7-3.2c-.2-.3 0-.4.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5z" /></>,
  discord: <><path d="M19.6 5a18 18 0 0 0-4.5-1.4l-.6 1.1a16 16 0 0 0-5 0l-.6-1.1A18 18 0 0 0 4.4 5 19.8 19.8 0 0 0 1 18.4a18.4 18.4 0 0 0 5.5 2.8l1.1-1.8-1.7-.8.4-.3a15.6 15.6 0 0 0 11.4 0l.4.3-1.7.8 1.1 1.8a18.4 18.4 0 0 0 5.5-2.8A19.8 19.8 0 0 0 19.6 5z" /><ellipse className={styles.cutout} cx="8" cy="12.6" rx="1.8" ry="2" /><ellipse className={styles.cutout} cx="16" cy="12.6" rx="1.8" ry="2" /></>
};

function isPublicSocialLink(link: AidreamcapesSocialLink) {
  if (!link.label?.trim() || !Object.prototype.hasOwnProperty.call(brandMarks, link.key)) return false;
  try {
    const url = new URL(link.href);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function AidreamcapesSocialLinks({ links, label }: { links?: readonly AidreamcapesSocialLink[]; label?: string }) {
  const visibleLinks = links?.filter(isPublicSocialLink) ?? [];
  if (!visibleLinks.length) return null;
  return (
    <ul aria-label={label} className={styles.links} data-social-links="true">
      {visibleLinks.map((link) => (
        <li key={link.key}>
          <a className={styles.link} href={link.href} rel="noopener noreferrer" target="_blank">
            <svg aria-hidden="true" className={styles.mark} fill="currentColor" focusable="false" height="18" viewBox="0 0 24 24" width="18">
              {brandMarks[link.key]}
            </svg>
            <span>{link.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
