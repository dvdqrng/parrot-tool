'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Key, Check, Cpu, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettingsContext } from '@/contexts/settings-context';
import { useAccounts } from '@/hooks/use-accounts';
import { toast } from 'sonner';
import { AiProvider } from '@/lib/types';
import { RECOMMENDED_MODELS } from '@/lib/ollama';

interface OllamaModel {
  name: string;
  size: number;
  modifiedAt: string;
}

interface OllamaStatus {
  available: boolean;
  models: OllamaModel[];
  error?: string;
}

export default function ApiKeysPage() {
  const { settings, updateSettings } = useSettingsContext();
  const { refetch } = useAccounts();

  const [beeperToken, setBeeperToken] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showBeeperToken, setShowBeeperToken] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // AI Provider state
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic');
  const [ollamaModel, setOllamaModel] = useState('llama3.1:8b');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);

  useEffect(() => {
    setBeeperToken(settings.beeperAccessToken || '');
    setAnthropicKey(settings.anthropicApiKey || '');
    setAiProvider(settings.aiProvider || 'anthropic');
    setOllamaModel(settings.ollamaModel || 'llama3.1:8b');
    setOllamaBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');
  }, [settings]);

  // Check Ollama status when provider is selected
  useEffect(() => {
    if (aiProvider === 'ollama') {
      checkOllamaStatus();
    }
  }, [aiProvider]);

  const checkOllamaStatus = async () => {
    setIsCheckingOllama(true);
    try {
      const response = await fetch(`/api/ollama/models?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const result = await response.json();
      setOllamaStatus(result.data);
    } catch {
      setOllamaStatus({ available: false, models: [], error: 'Failed to check Ollama status' });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  const handleSaveBeeperToken = () => {
    updateSettings({ beeperAccessToken: beeperToken || undefined });
    toast.success('Beeper token saved');
    setTimeout(refetch, 100);
  };

  const handleSaveAnthropicKey = () => {
    updateSettings({ anthropicApiKey: anthropicKey || undefined });
    toast.success('Anthropic API key saved');
  };

  const handleSaveAiProvider = () => {
    updateSettings({
      aiProvider,
      ollamaModel: aiProvider === 'ollama' ? ollamaModel : undefined,
      ollamaBaseUrl: aiProvider === 'ollama' ? ollamaBaseUrl : undefined,
    });
    toast.success(`AI provider set to ${aiProvider === 'ollama' ? 'Ollama (local)' : 'Anthropic Claude'}`);
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-medium">API Keys & AI Provider</h2>
        <p className="text-xs text-muted-foreground">
          Configure your API keys and choose your AI provider
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" strokeWidth={1.5} />
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
                  <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </Button>
            </div>
            <Button onClick={handleSaveBeeperToken} size="icon">
              <Check className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
          {settings.beeperAccessToken && (
            <p className="text-xs text-green-600">Token configured</p>
          )}
        </CardContent>
      </Card>

      {/* AI Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" strokeWidth={1.5} />
            AI Provider
          </CardTitle>
          <CardDescription>
            Choose between cloud AI (Anthropic Claude) or local AI (Ollama)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={aiProvider === 'anthropic' ? 'default' : 'outline'}
              onClick={() => setAiProvider('anthropic')}
              className="flex-1"
            >
              Anthropic Claude
            </Button>
            <Button
              variant={aiProvider === 'ollama' ? 'default' : 'outline'}
              onClick={() => setAiProvider('ollama')}
              className="flex-1"
            >
              Ollama (Local)
            </Button>
          </div>

          {aiProvider === 'anthropic' && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-xs font-medium mb-2">Anthropic API Key</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Get this from{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    console.anthropic.com
                  </a>
                </p>
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
                        <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </Button>
                  </div>
                  <Button onClick={handleSaveAnthropicKey} size="icon">
                    <Check className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
                {settings.anthropicApiKey && (
                  <p className="text-xs text-green-600 mt-2">API key configured</p>
                )}
              </div>
            </div>
          )}

          {aiProvider === 'ollama' && (
            <div className="space-y-4 pt-4 border-t">
              {/* Ollama Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCheckingOllama ? (
                    <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                  ) : ollamaStatus?.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.5} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                  )}
                  <span className="text-xs">
                    {isCheckingOllama
                      ? 'Checking Ollama...'
                      : ollamaStatus?.available
                        ? 'Ollama is running'
                        : ollamaStatus?.error || 'Ollama is not running'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkOllamaStatus}
                  disabled={isCheckingOllama}
                >
                  <RefreshCw className={`h-4 w-4 ${isCheckingOllama ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                </Button>
              </div>

              {/* Ollama Base URL */}
              <div>
                <p className="text-xs font-medium mb-2">Ollama URL</p>
                <Input
                  value={ollamaBaseUrl}
                  onChange={(e) => setOllamaBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>

              {/* Model Selection */}
              <div>
                <p className="text-xs font-medium mb-2">Model</p>
                {ollamaStatus?.available && ollamaStatus.models.length > 0 ? (
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {ollamaStatus.models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name} ({formatSize(model.size)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <Input
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.1:8b"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommended models: {RECOMMENDED_MODELS.map(m => m.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {!ollamaStatus?.available && (
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                  <p className="font-medium mb-1">To use Ollama:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">ollama.com</a></li>
                    <li>Run: <code className="bg-background px-1 rounded">ollama pull llama3.1:8b</code></li>
                    <li>Start Ollama (it runs automatically on install)</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSaveAiProvider} className="w-full">
            Save AI Provider Settings
          </Button>

          {settings.aiProvider && (
            <p className="text-xs text-green-600">
              Using: {settings.aiProvider === 'ollama' ? `Ollama (${settings.ollamaModel})` : 'Anthropic Claude'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
