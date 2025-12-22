import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBeeperClient, getPlatformFromAccountId, getPlatformInfo } from '@/lib/beeper-client';
import { BeeperAccount } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);
    const accountsArray = await client.accounts.list();

    const accounts: BeeperAccount[] = accountsArray.map((account) => {
      const platform = getPlatformFromAccountId(account.accountID);
      const platformData = getPlatformInfo(platform);

      return {
        id: account.accountID,
        service: platform,
        displayName: account.network || platformData.name,
        avatarUrl: account.user?.imgURL,
      };
    });

    return NextResponse.json({ data: accounts });
  } catch (error) {
    logger.error('Error fetching accounts:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch accounts. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
