// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output, always. The site must open on a bad connection, must not be
// able to leak, and must not be able to disagree with the records it is built
// from. Every page is regenerated from data/ on every deploy.
export default defineConfig({
  site: 'https://nishtha2403.github.io',
  base: '/antar',
  trailingSlash: 'ignore',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap()],
  i18n: {
    // English is the authoring root; Hindi lives under /hi/.
    defaultLocale: 'en',
    locales: ['en', 'hi'],
    routing: { prefixDefaultLocale: false },
  },
  devToolbar: { enabled: false },
});
