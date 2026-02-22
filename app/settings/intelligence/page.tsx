'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Brain,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  RefreshCw,
  Trash2,
  Loader2,
  Sparkles,
  Database,
  Zap,
  Users,
  Clock,
  Activity,
} from 'lucide-react';
import { useIntelligence } from '@/contexts/intelligence-context';
import {
  loadIntelligenceSettings,
  saveIntelligenceSettings,
  type IntelligenceSettings,
  type AIProvider,
} from '@/lib/intelligence-settings';
import {
  contactStore,
  extractionQueueStore,
  userStateStore,
  agentStore,
} from '@/lib/intelligence/knowledge/store';
import { StreamOfConsciousness } from '@/components/intelligence/stream-of-consciousness';
import { MemoryPanel } from '@/components/intelligence/memory-panel';
import {
  getActivityStats,
  clearActivityLog,
} from '@/lib/intelligence/activity-log';

export default function IntelligenceSettingsPage() {
  const intelligence = useIntelligence();

  // Settings state
  const [settings, setSettings] = useState<IntelligenceSettings>({
    provider: 'anthropic',
    anthropicApiKey: '',
    openaiApiKey: '',
    enableExtraction: true,
    enableAmbientProcessing: true,
    enableProactiveSuggestions: true,
  });
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [anthropicKeyStatus, setAnthropicKeyStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [openaiKeyStatus, setOpenaiKeyStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [isTestingAnthropic, setIsTestingAnthropic] = useState(false);
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Debug stats
  const [debugStats, setDebugStats] = useState({
    contactCount: 0,
    factCount: 0,
    queueSize: 0,
    agentCount: 0,
    userStateExists: false,
  });
  const [activityStats, setActivityStats] = useState({
    total: 0,
    last24h: 0,
    byType: {} as Record<string, number>,
    byAgent: {} as Record<string, number>,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loaded = loadIntelligenceSettings();
    setSettings(loaded);
    if (loaded.anthropicApiKey) {
      setAnthropicKeyStatus('unknown');
    }
    if (loaded.openaiApiKey) {
      setOpenaiKeyStatus('unknown');
    }
  }, []);

  // Load debug stats
  useEffect(() => {
    async function loadStats() {
      setIsLoadingStats(true);
      try {
        const [contacts, queueSize, agentCount, userState, actStats] = await Promise.all([
          contactStore.getAll(),
          extractionQueueStore.count(),
          agentStore.count(),
          userStateStore.get(),
          getActivityStats(),
        ]);

        const factCount = contacts.reduce((sum, c) => sum + (c.facts?.length || 0), 0);

        setDebugStats({
          contactCount: contacts.length,
          factCount,
          queueSize,
          agentCount,
          userStateExists: !!userState,
        });

        setActivityStats(actStats);
      } catch (error) {
        console.error('Failed to load debug stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    }

    loadStats();
  }, [intelligence.stats]);

  // Test Anthropic API key
  const testAnthropicKey = async () => {
    if (!settings.anthropicApiKey) {
      setAnthropicKeyStatus('invalid');
      return;
    }

    setIsTestingAnthropic(true);
    try {
      const response = await fetch('/api/intelligence/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'anthropic', apiKey: settings.anthropicApiKey }),
      });

      if (response.ok) {
        setAnthropicKeyStatus('valid');
      } else {
        setAnthropicKeyStatus('invalid');
      }
    } catch {
      setAnthropicKeyStatus('invalid');
    } finally {
      setIsTestingAnthropic(false);
    }
  };

  // Test OpenAI API key
  const testOpenAIKey = async () => {
    if (!settings.openaiApiKey) {
      setOpenaiKeyStatus('invalid');
      return;
    }

    setIsTestingOpenAI(true);
    try {
      const response = await fetch('/api/intelligence/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', apiKey: settings.openaiApiKey }),
      });

      if (response.ok) {
        setOpenaiKeyStatus('valid');
      } else {
        setOpenaiKeyStatus('invalid');
      }
    } catch {
      setOpenaiKeyStatus('invalid');
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveIntelligenceSettings(settings);
      // Refresh intelligence context
      await intelligence.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  // Clear all intelligence data
  const handleClearData = async () => {
    if (!confirm('This will delete all learned intelligence data. Are you sure?')) {
      return;
    }

    try {
      // Clear all stores
      const contacts = await contactStore.getAll();
      for (const contact of contacts) {
        await contactStore.delete(contact.id);
      }

      await userStateStore.clear();

      // Clear extraction queue
      const queue = await extractionQueueStore.getAll();
      for (const item of queue) {
        await extractionQueueStore.remove(item.id);
      }

      // Refresh stats
      setDebugStats({
        contactCount: 0,
        factCount: 0,
        queueSize: 0,
        agentCount: 0,
        userStateExists: false,
      });

      await intelligence.refresh();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };

  const activeKeyConfigured = settings.provider === 'anthropic'
    ? !!settings.anthropicApiKey
    : !!settings.openaiApiKey;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Intelligence
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure AI-powered features and view system status
        </p>
      </div>

      {/* Memory & Identity */}
      <MemoryPanel />

      <Separator />

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Provider
          </CardTitle>
          <CardDescription className="text-xs">
            Choose which AI provider to use for intelligence features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.provider}
            onValueChange={(value: AIProvider) => setSettings({ ...settings, provider: value })}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="anthropic" id="anthropic" />
              <Label htmlFor="anthropic" className="text-sm cursor-pointer flex items-center gap-2">
                Anthropic (Claude)
                {settings.provider === 'anthropic' && settings.anthropicApiKey && (
                  <Badge variant="outline" className="text-xs">Active</Badge>
                )}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="openai" id="openai" />
              <Label htmlFor="openai" className="text-sm cursor-pointer flex items-center gap-2">
                OpenAI (GPT)
                {settings.provider === 'openai' && settings.openaiApiKey && (
                  <Badge variant="outline" className="text-xs">Active</Badge>
                )}
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* API Keys Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your API keys for each provider. Only the selected provider's key will be used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Anthropic API Key */}
          <div className="space-y-2">
            <Label htmlFor="anthropicKey" className="text-xs flex items-center gap-2">
              Anthropic API Key
              {settings.provider === 'anthropic' && (
                <Badge variant="secondary" className="text-xs">Selected</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="anthropicKey"
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={settings.anthropicApiKey}
                  onChange={(e) => {
                    setSettings({ ...settings, anthropicApiKey: e.target.value });
                    setAnthropicKeyStatus('unknown');
                  }}
                  placeholder="sk-ant-..."
                  className="pr-10 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                >
                  {showAnthropicKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testAnthropicKey}
                disabled={!settings.anthropicApiKey || isTestingAnthropic}
              >
                {isTestingAnthropic ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            {anthropicKeyStatus !== 'unknown' && (
              <div className="flex items-center gap-2 text-xs">
                {anthropicKeyStatus === 'valid' ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">API key is valid</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">API key is invalid</span>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Get your key from{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>

          <Separator />

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <Label htmlFor="openaiKey" className="text-xs flex items-center gap-2">
              OpenAI API Key
              {settings.provider === 'openai' && (
                <Badge variant="secondary" className="text-xs">Selected</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openaiKey"
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={settings.openaiApiKey}
                  onChange={(e) => {
                    setSettings({ ...settings, openaiApiKey: e.target.value });
                    setOpenaiKeyStatus('unknown');
                  }}
                  placeholder="sk-..."
                  className="pr-10 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                >
                  {showOpenAIKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testOpenAIKey}
                disabled={!settings.openaiApiKey || isTestingOpenAI}
              >
                {isTestingOpenAI ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            {openaiKeyStatus !== 'unknown' && (
              <div className="flex items-center gap-2 text-xs">
                {openaiKeyStatus === 'valid' ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">API key is valid</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">API key is invalid</span>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Get your key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com
              </a>
            </p>
          </div>

          {!activeKeyConfigured && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No API key configured for the selected provider. AI features will not work until you add a key.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Features
          </CardTitle>
          <CardDescription className="text-xs">
            Enable or disable AI-powered features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Knowledge Extraction</Label>
              <p className="text-xs text-muted-foreground">
                Extract facts and relationships from messages
              </p>
            </div>
            <Switch
              checked={settings.enableExtraction}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enableExtraction: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Ambient Processing</Label>
              <p className="text-xs text-muted-foreground">
                Analyze your messages to understand your context
              </p>
            </div>
            <Switch
              checked={settings.enableAmbientProcessing}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enableAmbientProcessing: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Proactive Suggestions</Label>
              <p className="text-xs text-muted-foreground">
                AI companion suggests drafts and insights
              </p>
            </div>
            <Switch
              checked={settings.enableProactiveSuggestions}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enableProactiveSuggestions: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Debug / Status Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            System Status
          </CardTitle>
          <CardDescription className="text-xs">
            View what the intelligence layer has learned
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStats ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Contacts</span>
                </div>
                <p className="text-lg font-semibold">{debugStats.contactCount}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Facts Extracted</span>
                </div>
                <p className="text-lg font-semibold">{debugStats.factCount}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Queue Size</span>
                </div>
                <p className="text-lg font-semibold">{debugStats.queueSize}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">User Profile</span>
                </div>
                <Badge variant={debugStats.userStateExists ? 'default' : 'secondary'}>
                  {debugStats.userStateExists ? 'Active' : 'Not created'}
                </Badge>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Intelligence Status</Label>
              <p className="text-xs text-muted-foreground">
                {intelligence.isInitialized ? 'Initialized' : 'Initializing...'}
                {intelligence.isProcessing && ' • Processing...'}
              </p>
            </div>
            <Badge variant={intelligence.isInitialized ? 'default' : 'secondary'}>
              {intelligence.isInitialized ? 'Ready' : 'Loading'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* AI Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            AI Activity Log
          </CardTitle>
          <CardDescription className="text-xs">
            Real-time view of AI agent thoughts and actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Activity Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-semibold">{activityStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-semibold">{activityStats.last24h}</p>
              <p className="text-xs text-muted-foreground">Last 24h</p>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-semibold">
                {Object.keys(activityStats.byAgent).length}
              </p>
              <p className="text-xs text-muted-foreground">Active Agents</p>
            </div>
          </div>

          <Separator />

          {/* Live Activity Stream */}
          <div className="border rounded-lg overflow-hidden">
            <StreamOfConsciousness
              maxEntries={50}
              showControls={true}
              className="h-[300px]"
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await clearActivityLog();
                setActivityStats({ total: 0, last24h: 0, byType: {}, byAgent: {} });
              }}
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Clear Activity Log
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleClearData}
          className="text-xs"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear All Data
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => intelligence.refresh()}
            className="text-xs"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs">
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
