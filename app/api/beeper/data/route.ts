import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createDataService, MissingTokenError } from '@/lib/beeper/data-service';
import { DataSlice, BeeperDataRequest } from '@/lib/beeper/types';

/**
 * GET /api/beeper/data - Unified data endpoint
 *
 * Query params:
 * - slices: comma-separated list of data slices (accounts, messages, userInfo)
 * - accountIds: comma-separated list of account IDs (required for messages)
 * - hiddenChatIds: comma-separated list of chat IDs to exclude
 * - cursor: pagination cursor for messages
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse slices
  const slicesParam = searchParams.get('slices') || 'accounts,messages';
  const slices = slicesParam.split(',').filter(Boolean) as DataSlice[];

  // Parse other params
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];
  const hiddenChatIds = searchParams.get('hiddenChatIds')?.split(',').filter(Boolean) || [];
  const cursor = searchParams.get('cursor') || undefined;

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const service = createDataService(beeperToken);

    const dataRequest: BeeperDataRequest = {
      slices,
      accountIds,
      hiddenChatIds,
      cursor,
    };

    const response = await service.fetchSlices(dataRequest);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    logger.error('Error fetching beeper data:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch data. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
