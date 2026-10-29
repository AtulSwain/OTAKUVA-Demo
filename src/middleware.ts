import { NextRequest, NextResponse } from 'next/server';
import { SecurityHeaders } from '@/lib/security/securityHeaders';
import { GUEST_COOKIE } from '@/lib/landing/guest';

export function middleware(request: NextRequest) {
  // Generate or preserve incoming Request ID for end-to-end tracing
  const requestId = request.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });
    preflightResponse.headers.set('X-Request-Id', requestId);
    SecurityHeaders.applyHeaders(preflightResponse);
    SecurityHeaders.applyCors(preflightResponse, request.headers.get('origin'));
    return preflightResponse;
  }

  // Landing page: a visitor with no session and no "browse as guest" cookie
  // opening the homepage goes to /welcome first. Cookie presence only (no JWT
  // check on the edge); the homepage itself re-checks the session properly.
  if (
    request.method === 'GET' &&
    request.nextUrl.pathname === '/' &&
    !request.cookies.get('anilog_token') &&
    !request.cookies.get(GUEST_COOKIE)
  ) {
    const redirect = NextResponse.redirect(new URL('/welcome', request.url), 307);
    redirect.headers.set('X-Request-Id', requestId);
    SecurityHeaders.applyHeaders(redirect);
    return redirect;
  }

  // Clone response and apply security headers + request tracking ID
  const response = NextResponse.next();
  response.headers.set('X-Request-Id', requestId);
  SecurityHeaders.applyHeaders(response);
  SecurityHeaders.applyCors(response, request.headers.get('origin'));

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
