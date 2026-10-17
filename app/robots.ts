import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/cart', '/checkout', '/order', '/wishlist'],
      },
    ],
    sitemap: 'https://thriv.pk/sitemap.xml',
    host: 'https://thriv.pk',
  };
}
