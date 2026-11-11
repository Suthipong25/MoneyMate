import { NextResponse, type NextRequest } from 'next/server';

// =============================================================================
// MoneyMate — Next.js Middleware for Multi-Role Route Protection & Security Headers
// Enforces Section 13 Redirection Rules:
// - Customer attempting /admin/* -> Redirected to /access-denied
// - Super Admin without mfaVerified attempting /admin/* -> Redirected to /access-denied
// - Suspended accounts -> Redirected to /login?error=suspended
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('moneymate_session')?.value;

  if (sessionCookie && sessionCookie.includes('.')) {
    try {
      const [encoded] = sessionCookie.split('.');
      const decoded = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      ) as {
        userId: string;
        role: string;
        status?: string;
        mfaVerified?: boolean;
        expiresAt: number;
      };

      if (Date.now() < decoded.expiresAt) {
        if (decoded.status === 'suspended') {
          return NextResponse.redirect(
            new URL('/login?error=suspended', request.url)
          );
        }
        // Customer or non-MFA admin trying to access /admin/* is blocked at the edge
        if (
          pathname.startsWith('/admin') &&
          (decoded.role !== 'super_admin' || decoded.mfaVerified === false)
        ) {
          return NextResponse.redirect(new URL('/access-denied', request.url));
        }
      }
    } catch {
      // Invalid cookie format; downstream server guards will handle
    }
  }

  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  return response;
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
