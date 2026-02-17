'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, ArrowRight, Loader2, CheckCircle, XCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { OnboardingStep } from './onboarding-step';
import { useAccounts } from '@/hooks/use-accounts';
import { getPlatformInfo } from '@/lib/beeper-client';
import { PlatformIcon } from '@/components/platform-icon';
import { toast } from 'sonner';
import { AppSettings } from '@/lib/types';

interface OnboardingChecklistProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  toggleAccount: (accountId: string) => void;
  selectAllAccounts: (accountIds: string[]) => void;
  deselectAllAccounts: () => void;
}

export function OnboardingChecklist({
  settings,
  updateSettings,
  toggleAccount,
  selectAllAccounts,
  deselectAllAccounts,
}: OnboardingChecklistProps) {
  // Step 1: Download Beeper - tracked locally
  const [beeperDownloaded, setBeeperDownloaded] = useState(false);

  // Step 2: Beeper token
  const [beeperToken, setBeeperToken] = useState(settings.beeperAccessToken || '');
  const [showBeeperToken, setShowBeeperToken] = useState(false);
  const [isTestingBeeper, setIsTestingBeeper] = useState(false);
  const [beeperStatus, setBeeperStatus] = useState<{ valid: boolean; error?: string } | null>(null);

  // Step 3: Platform selection
  const { accounts, isLoading: isLoadingAccounts, error: accountsError, refetch } = useAccounts();

  // Completion states
  const hasBeeperToken = !!settings.beeperAccessToken;
  const hasPlatforms = settings.selectedAccountIds.length > 0;

  // Determine current step (sequential)
  const currentStep = !beeperDownloaded ? 1
    : !hasBeeperToken ? 2
    : 3;

  // Auto-fetch accounts when Beeper token is set
  useEffect(() => {
    if (hasBeeperToken && accounts.length === 0 && !isLoadingAccounts) {
      refetch();
    }
  }, [hasBeeperToken, accounts.length, isLoadingAccounts, refetch]);

  // Handle Beeper token validation
  const handleSaveBeeper = async () => {
    if (!beeperToken.trim()) {
      toast.error('Please enter a Beeper access token');
      return;
    }

    setIsTestingBeeper(true);
    setBeeperStatus(null);

    try {
      const response = await fetch('/api/beeper/data?slices=accounts', {
        headers: { 'x-beeper-token': beeperToken },
      });
      const result = await response.json();

      if (result.error) {
        setBeeperStatus({ valid: false, error: result.error });
        toast.error(result.error);
      } else {
        setBeeperStatus({ valid: true });
        updateSettings({ beeperAccessToken: beeperToken });
        toast.success('Beeper connected successfully');
      }
    } catch {
      setBeeperStatus({ valid: false, error: 'Failed to connect to Beeper' });
      toast.error('Failed to connect to Beeper');
    } finally {
      setIsTestingBeeper(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-sm font-medium">Welcome to Parrot</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Let's get you set up in a few steps
          </p>
        </div>

        {/* Step 1: Download Beeper */}
        <OnboardingStep
          stepNumber={1}
          title="Get Beeper Desktop"
          description="Download and install Beeper to connect your messaging apps"
          isComplete={beeperDownloaded}
          isActive={currentStep === 1}
        >
          <div className="space-y-4">
            <a
              href="https://beeper.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
              Download from beeper.com
            </a>
            <p className="text-xs text-muted-foreground">
              After installing, log in and connect at least one messaging platform.
            </p>
            <Button
              size="sm"
              onClick={() => setBeeperDownloaded(true)}
              className="w-full"
            >
              I have Beeper installed
              <ArrowRight className="h-3 w-3 ml-2" strokeWidth={2} />
            </Button>
          </div>
        </OnboardingStep>

        {/* Step 2: Beeper Token */}
        <OnboardingStep
          stepNumber={2}
          title="Connect Beeper"
          description="Enter your access token from Beeper Desktop"
          isComplete={hasBeeperToken}
          isActive={currentStep === 2}
        >
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>In Beeper Desktop:</p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>Go to Settings</li>
                <li>Click on Developer</li>
                <li>Scroll to Approved Connections</li>
                <li>Add a new connection and copy the code</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showBeeperToken ? 'text' : 'password'}
                  placeholder="Paste your access token"
                  value={beeperToken}
                  onChange={(e) => setBeeperToken(e.target.value)}
                  className="pr-10 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowBeeperToken(!showBeeperToken)}
                >
                  {showBeeperToken ? (
                    <EyeOff className="h-3 w-3" strokeWidth={2} />
                  ) : (
                    <Eye className="h-3 w-3" strokeWidth={2} />
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                onClick={handleSaveBeeper}
                disabled={!beeperToken.trim() || isTestingBeeper}
              >
                {isTestingBeeper ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                )}
              </Button>
            </div>
            {beeperStatus && (
              <div className={`flex items-center gap-2 text-xs ${beeperStatus.valid ? 'text-green-600' : 'text-red-500'}`}>
                {beeperStatus.valid ? (
                  <CheckCircle className="h-3 w-3" strokeWidth={2} />
                ) : (
                  <XCircle className="h-3 w-3" strokeWidth={2} />
                )}
                <span>{beeperStatus.valid ? 'Connected successfully' : beeperStatus.error}</span>
              </div>
            )}
          </div>
        </OnboardingStep>

        {/* Step 3: Select Platforms */}
        <OnboardingStep
          stepNumber={3}
          title="Select Platforms"
          description="Choose which messaging platforms to show"
          isComplete={hasPlatforms}
          isActive={currentStep === 3}
        >
          <div className="space-y-4">
            {accountsError ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
                <p className="text-xs">{accountsError}</p>
              </div>
            ) : isLoadingAccounts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={2} />
              </div>
            ) : accounts.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  No connected platforms found. Connect messaging apps in Beeper Desktop first.
                </p>
                <Button variant="outline" size="sm" onClick={refetch} className="w-full">
                  <RefreshCw className="h-3 w-3 mr-2" strokeWidth={2} />
                  Refresh
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllAccounts(accounts.map(a => a.id))}
                    className="text-xs"
                    disabled={settings.selectedAccountIds.length === accounts.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllAccounts}
                    className="text-xs"
                    disabled={settings.selectedAccountIds.length === 0}
                  >
                    Deselect All
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {accounts.map((account) => {
                    const platformData = getPlatformInfo(account.service);
                    const isSelected = settings.selectedAccountIds.includes(account.id);

                    return (
                      <div
                        key={account.id}
                        className="flex items-center space-x-3 rounded-lg border p-2 transition-colors hover:bg-muted/50"
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
                          <div className="flex items-center gap-2">
                            <PlatformIcon platform={account.service} className="h-4 w-4" />
                            <span className="text-xs font-medium">{platformData.name}</span>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.selectedAccountIds.length} of {accounts.length} platforms selected
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={settings.selectedAccountIds.length === 0}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </OnboardingStep>
      </div>
    </div>
  );
}
