'use client';

import { useEffect } from 'react';
import { RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAccounts } from '@/hooks/use-accounts';
import { useSettingsContext } from '@/contexts/settings-context';
import { getPlatformInfo } from '@/lib/beeper-client';
import { PlatformIcon } from '@/components/platform-icon';

export default function PlatformsPage() {
  const { accounts, isLoading, error, refetch } = useAccounts();
  const { settings, toggleAccount, selectAllAccounts, deselectAllAccounts } = useSettingsContext();

  useEffect(() => {
    if (accounts.length > 0 && settings.selectedAccountIds.length === 0) {
      selectAllAccounts(accounts.map(a => a.id));
    }
  }, [accounts, settings.selectedAccountIds.length, selectAllAccounts]);

  const allSelected = accounts.length > 0 && accounts.every(a => settings.selectedAccountIds.includes(a.id));
  const noneSelected = settings.selectedAccountIds.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-medium">Connected Platforms</h2>
        <p className="text-xs text-muted-foreground">
          Select which messaging platforms to include in your Kanban board
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4" strokeWidth={1.5} />
                Messaging Platforms
              </CardTitle>
              <CardDescription>
                {settings.selectedAccountIds.length} of {accounts.length} platforms selected
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
              <p className="text-xs font-medium">Connection Error</p>
              <p className="text-xs">{error}</p>
              <p className="mt-2 text-xs">
                Make sure Beeper Desktop is running and the API is enabled in Settings → Developers.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">No connected accounts found</p>
              <p className="text-xs text-muted-foreground">
                {settings.beeperAccessToken
                  ? 'Connect messaging platforms in Beeper Desktop first.'
                  : 'Enter your Beeper access token in API Keys settings, then click Refresh.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllAccounts(accounts.map(a => a.id))}
                  disabled={allSelected}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllAccounts}
                  disabled={noneSelected}
                >
                  Deselect All
                </Button>
              </div>
              <div className="space-y-3">
                {accounts.map((account) => {
                  const platformData = getPlatformInfo(account.service);
                  const isSelected = settings.selectedAccountIds.includes(account.id);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        id={account.id}
                        checked={isSelected}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <label
                        htmlFor={account.id}
                        className="flex flex-1 cursor-pointer items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <PlatformIcon platform={account.service} className="h-4 w-4" />
                          <span className="text-xs font-medium">{platformData.name}</span>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {account.service}
                        </Badge>
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
