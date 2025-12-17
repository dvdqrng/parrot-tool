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
  const { settings, isLoaded, updateSettings } = useSettingsContext();
  const { refetch } = useAccounts();

  const [beeperToken, setBeeperToken] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showBeeperToken, setShowBeeperToken] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [openAiKey, setOpenAiKey] = useState('');
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);

  // AI Provider state
  const [aiProvider, setAiProvider] = useState<AiProvider>('anthropic');
  const [ollamaModel, setOllamaModel] = useState('deepseek-v3');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);

  useEffect(() => {
    setBeeperToken(settings.beeperAccessToken || '');
    setAnthropicKey(settings.anthropicApiKey || '');
    setOpenAiKey(settings.openaiApiKey || '');
    setAiProvider(settings.aiProvider || 'anthropic');
    setOllamaModel(settings.ollamaModel || 'deepseek-v3');
    setOllamaBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');
  }, [settings]);

  // Check Ollama status when provider is selected
  // Check Ollama status when provider is selected
  useEffect(() => {
    const checkOllama = async () => {
      setIsCheckingOllama(true);
      try {
        const response = await fetch(`/api/ollama/models?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
        const result = await response.json();
        setOllamaStatus(result.data);

        if (result.data.available && result.data.models.length > 0) {
          const availableModelNames = result.data.models.map((m: { name: string }) => m.name);
          setOllamaModel(currentModel => {
            if (!availableModelNames.includes(currentModel)) {
              const firstModel = result.data.models[0].name;
              console.log(`[Settings] Auto-selected first available model: ${firstModel}`);
              return firstModel;
            }
            return currentModel;
          });
        }
      } catch {
        setOllamaStatus({ available: false, models: [], error: 'Failed to check Ollama status' });
      } finally {
        setIsCheckingOllama(false);
      }
    };

    if (aiProvider === 'ollama') {
      checkOllama();
    }
  }, [aiProvider, ollamaBaseUrl]);

  const handleRefreshOllamaStatus = async () => {
    setIsCheckingOllama(true);
    try {
      const response = await fetch(`/api/ollama/models?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const result = await response.json();
      setOllamaStatus(result.data);

      if (result.data.available && result.data.models.length > 0) {
        const availableModelNames = result.data.models.map((m: { name: string }) => m.name);
        setOllamaModel(currentModel => {
          if (!availableModelNames.includes(currentModel)) {
            const firstModel = result.data.models[0].name;
            console.log(`[Settings] Auto-selected first available model: ${firstModel}`);
            return firstModel;
          }
          return currentModel;
        });
      }
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

  const handleSaveOpenAiKey = () => {
    updateSettings({ openaiApiKey: openAiKey || undefined });
    toast.success('OpenAI API key saved');
  };

  const handleSaveAiProvider = () => {
    updateSettings({
      aiProvider,
      ollamaModel: aiProvider === 'ollama' ? ollamaModel : undefined,
      ollamaBaseUrl: aiProvider === 'ollama' ? ollamaBaseUrl : undefined,
    });
    const providerName =
      aiProvider === 'ollama'
        ? 'Ollama (local)'
        : aiProvider === 'openai'
          ? 'OpenAI'
          : 'Anthropic Claude';
    toast.success(`AI provider set to ${providerName}`);
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
            <Key className="h-4 w-4" strokeWidth={2} />
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
                  <EyeOff className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
            </div>
            <Button onClick={handleSaveBeeperToken} size="icon">
              <Check className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
          {isLoaded && settings.beeperAccessToken && (
            <p className="text-xs text-green-600">Token configured</p>
          )}
        </CardContent>
      </Card>

      {/* AI Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" strokeWidth={2} />
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
              variant={aiProvider === 'openai' ? 'default' : 'outline'}
              onClick={() => setAiProvider('openai')}
              className="flex-1"
            >
              OpenAI
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
                        <EyeOff className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={2} />
                      )}
                    </Button>
                  </div>
                  <Button onClick={handleSaveAnthropicKey} size="icon">
                    <Check className="h-4 w-4" strokeWidth={2} />
                  </Button>
                </div>
                {isLoaded && settings.anthropicApiKey && (
                  <p className="text-xs text-green-600 mt-2">API key configured</p>
                )}
              </div>
            </div>
          )}

          {aiProvider === 'openai' && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-xs font-medium mb-2">OpenAI API Key</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Get this from{' '}
                  <a
                    href="https://platform.openai.com/account/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    platform.openai.com
                  </a>
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showOpenAiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                    >
                      {showOpenAiKey ? (
                        <EyeOff className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={2} />
                      )}
                    </Button>
                  </div>
                  <Button onClick={handleSaveOpenAiKey} size="icon">
                    <Check className="h-4 w-4" strokeWidth={2} />
                  </Button>
                </div>
                {isLoaded && settings.openaiApiKey && (
                  <p className="text-xs text-green-600 mt-2">API key configured</p>
                )}
              </div>
            </div>
          )}

          {aiProvider === 'ollama' && (
            <div className="space-y-4 pt-4 border-t">
              {/* Ollama Status */}
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  {isCheckingOllama ? (
                    <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : ollamaStatus?.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" strokeWidth={2} />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" strokeWidth={2} />
                  )}
                  <span className="text-xs font-medium">
                    {isCheckingOllama
                      ? 'Checking Ollama...'
                      : ollamaStatus?.available
                        ? `Ollama running (${ollamaStatus.models.length} models)`
                        : ollamaStatus?.error || 'Ollama is not running'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshOllamaStatus}
                  disabled={isCheckingOllama}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isCheckingOllama ? 'animate-spin' : ''}`} strokeWidth={2} />
                  Refresh
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">Model</p>
                  {ollamaStatus?.available && ollamaStatus.models.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {ollamaStatus.models.length} installed
                    </p>
                  )}
                </div>

                {ollamaStatus?.available && ollamaStatus.models.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                      >
                        {ollamaStatus.models.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name} ({formatSize(model.size)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Just downloaded a new model? Click the <strong>Refresh</strong> button above to see it
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Or manually enter model name:
                      </p>
                      <Input
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        placeholder="e.g., deepseek-v3"
                        className="text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="Enter model name (e.g., deepseek-v3)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Install DeepSeek-V3 for best style matching: <code className="bg-muted px-1 rounded">ollama pull deepseek-v3</code>
                    </p>
                  </div>
                )}
              </div>

              {!ollamaStatus?.available && (
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                  <p className="font-medium mb-1">To use Ollama:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Install Ollama from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">ollama.com</a></li>
                    <li>Pull DeepSeek-V3 (best for style matching): <code className="bg-background px-1 rounded">ollama pull deepseek-v3</code></li>
                    <li>Ollama runs automatically after install</li>
                  </ol>
                </div>
              )}

              {ollamaStatus?.available && ollamaStatus.models.length === 0 && (
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                  <p className="font-medium mb-1">No models found!</p>
                  <p>Install DeepSeek-V3: <code className="bg-background px-1 rounded">ollama pull deepseek-v3</code></p>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSaveAiProvider} className="w-full">
            Save AI Provider Settings
          </Button>

          {isLoaded && settings.aiProvider && (
            <p className="text-xs text-green-600">
              Using:{' '}
              {settings.aiProvider === 'ollama'
                ? `Ollama (${settings.ollamaModel})`
                : settings.aiProvider === 'openai'
                  ? 'OpenAI'
                  : 'Anthropic Claude'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
