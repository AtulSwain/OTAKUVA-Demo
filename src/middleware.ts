import { NextRequest, NextResponse } from 'next/server';
import { SecurityHeaders } from '@/lib/security/securityHeaders';

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
