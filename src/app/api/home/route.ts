import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { getHomeData } from '../../../lib/home/getHomeData';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  const data = await getHomeData(authUser);
  return NextResponse.json(data);
}
