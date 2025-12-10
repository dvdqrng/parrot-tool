'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Key, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettingsContext } from '@/contexts/settings-context';
import { useAccounts } from '@/hooks/use-accounts';
import { toast } from 'sonner';

export default function ApiKeysPage() {
  const { settings, updateSettings } = useSettingsContext();
  const { refetch } = useAccounts();

  const [beeperToken, setBeeperToken] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showBeeperToken, setShowBeeperToken] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  useEffect(() => {
    setBeeperToken(settings.beeperAccessToken || '');
    setAnthropicKey(settings.anthropicApiKey || '');
  }, [settings.beeperAccessToken, settings.anthropicApiKey]);

  const handleSaveBeeperToken = () => {
    updateSettings({ beeperAccessToken: beeperToken || undefined });
    toast.success('Beeper token saved');
    setTimeout(refetch, 100);
  };

  const handleSaveAnthropicKey = () => {
    updateSettings({ anthropicApiKey: anthropicKey || undefined });
    toast.success('Anthropic API key saved');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">API Keys</h2>
        <p className="text-muted-foreground">
          Configure your API keys to connect to Beeper and enable AI features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Beeper Access Token
          </CardTitle>
          <CardDescription>
            Get this from Beeper Desktop: Settings → Developers → Access Token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="beeper-token"
                type={showBeeperToken ? 'text' : 'password'}
                placeholder="Enter your Beeper access token"
                value={beeperToken}
                onChange={(e) => setBeeperToken(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowBeeperToken(!showBeeperToken)}
              >
                {showBeeperToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button onClick={handleSaveBeeperToken} size="icon">
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {settings.beeperAccessToken && (
            <p className="text-xs text-green-600">Token configured</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Get this from{' '}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              console.anthropic.com
            </a>
            {' '}(for AI draft suggestions)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="anthropic-key"
                type={showAnthropicKey ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              >
                {showAnthropicKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button onClick={handleSaveAnthropicKey} size="icon">
              <Check className="h-4 w-4" />
            </Button>
          </div>
          {settings.anthropicApiKey && (
            <p className="text-xs text-green-600">API key configured</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
