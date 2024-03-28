import { Pathnames } from 'next-intl/navigation';

export const locales = ['en', 'zh'] as const;

export const pathnames = {
  '/': '/',
  '/workflows': {
    en: '/workflows',
    zh: '/workflows'
  }
} satisfies Pathnames<typeof locales>;

// Use the default: `always`
export const localePrefix = undefined;

export type AppPathnames = keyof typeof pathnames;
