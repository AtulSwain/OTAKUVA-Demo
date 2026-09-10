import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Signed out successfully.' });
  response.cookies.delete('anilog_token');
  return response;
}
