import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || 'https://moneymate.co.th';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/tools/vat-calculator', '/login', '/register'],
        disallow: ['/app/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
