'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { loadToneSettings, saveToneSettings, loadCachedUserMessages, saveCachedUserMessages, loadSettings, CachedUserMessage } from '@/lib/storage';
import { ToneSettings as ToneSettingsType } from '@/lib/types';
import { toast } from 'sonner';

interface ToneAnalysis {
  briefDetailed: number;
  formalCasual: number;
  messageCount: number;
}

function analyzeTone(messages: { text: string }[]): ToneAnalysis {
  if (messages.length === 0) {
    return { briefDetailed: 50, formalCasual: 50, messageCount: 0 };
  }

  let totalLength = 0;
  let formalIndicators = 0;
  let casualIndicators = 0;

  const casualPatterns = [
    /\b(lol|haha|hehe|lmao|rofl)\b/gi,
    /[!]{2,}/g,
    /\.\.\./g,
    /\b(gonna|wanna|gotta|kinda|sorta)\b/gi,
    /\b(yeah|yep|nope|nah)\b/gi,
    /😀|😁|😂|🤣|😊|😍|🥰|😘|🤗|😜|😝|🤪|👍|👎|❤️|💕|💖|🔥|✨|🎉|💯/g,
  ];

  const formalPatterns = [
    /\b(therefore|however|furthermore|consequently|nevertheless)\b/gi,
    /\b(please|kindly|regards|sincerely)\b/gi,
    /\b(would you|could you|may I|shall we)\b/gi,
    /\b(appreciate|grateful|thank you)\b/gi,
  ];

  for (const msg of messages) {
    const text = msg.text;
    totalLength += text.length;

    for (const pattern of casualPatterns) {
      const matches = text.match(pattern);
      if (matches) casualIndicators += matches.length;
    }

    for (const pattern of formalPatterns) {
      const matches = text.match(pattern);
      if (matches) formalIndicators += matches.length;
    }
  }

  // Calculate average message length (brief vs detailed)
  const avgLength = totalLength / messages.length;
  // Short messages ~20 chars = 0, long messages ~200+ chars = 100
  const briefDetailed = Math.min(100, Math.max(0, ((avgLength - 20) / 180) * 100));

  // Calculate formal vs casual
  const totalIndicators = formalIndicators + casualIndicators;
  let formalCasual = 50;
  if (totalIndicators > 0) {
    // More casual indicators = higher value (more casual)
    formalCasual = (casualIndicators / totalIndicators) * 100;
  }

  return {
    briefDetailed: Math.round(briefDetailed),
    formalCasual: Math.round(formalCasual),
    messageCount: messages.length,
  };
}

export function ToneSettingsSection() {
  const [settings, setSettings] = useState<ToneSettingsType>({
    briefDetailed: 50,
    formalCasual: 50,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cachedMessageCount, setCachedMessageCount] = useState(0);
  const [hasBeeperToken, setHasBeeperToken] = useState(false);

  useEffect(() => {
    const loaded = loadToneSettings();
    setSettings(loaded);
    const cachedMessages = loadCachedUserMessages();
    setCachedMessageCount(cachedMessages.length);
    const appSettings = loadSettings();
    setHasBeeperToken(!!appSettings.beeperAccessToken);
  }, []);

  const handleSliderChange = useCallback((key: 'briefDetailed' | 'formalCasual', value: number[]) => {
    const newSettings = { ...settings, [key]: value[0] };
    setSettings(newSettings);
    saveToneSettings(newSettings);
  }, [settings]);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);

    try {
      const appSettings = loadSettings();
      const headers: HeadersInit = {};
      if (appSettings.beeperAccessToken) {
        headers['x-beeper-token'] = appSettings.beeperAccessToken;
      }

      // Fetch a sample of user messages (up to 100 messages from 15 recent chats)
      const response = await fetch('/api/beeper/user-messages', {
        headers,
      });

      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        setIsAnalyzing(false);
        return;
      }

      const messages: CachedUserMessage[] = result.data || [];

      // Cache the messages for future use
      saveCachedUserMessages(messages);
      setCachedMessageCount(messages.length);

      // Analyze the tone
      const analysis = analyzeTone(messages);

      const newSettings: ToneSettingsType = {
        briefDetailed: analysis.briefDetailed,
        formalCasual: analysis.formalCasual,
        analyzedMessageCount: analysis.messageCount,
        lastAnalyzedAt: new Date().toISOString(),
      };

      setSettings(newSettings);
      saveToneSettings(newSettings);

      if (analysis.messageCount > 0) {
        toast.success(`Analyzed ${analysis.messageCount} messages from ${result.stats?.chatsScanned || 0} chats`);
      } else {
        toast.info('No messages found to analyze');
      }
    } catch (error) {
      console.error('Error analyzing tone:', error);
      toast.error('Failed to analyze messages. Make sure Beeper Desktop is running.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleAnalyzeFromCache = useCallback(() => {
    const messages = loadCachedUserMessages();
    if (messages.length === 0) {
      toast.info('No cached messages. Click "Fetch & Analyze" first.');
      return;
    }

    const analysis = analyzeTone(messages);

    const newSettings: ToneSettingsType = {
      briefDetailed: analysis.briefDetailed,
      formalCasual: analysis.formalCasual,
      analyzedMessageCount: analysis.messageCount,
      lastAnalyzedAt: new Date().toISOString(),
    };

    setSettings(newSettings);
    saveToneSettings(newSettings);

    toast.success(`Re-analyzed ${analysis.messageCount} cached messages`);
  }, []);

  const getBriefDetailedLabel = (value: number) => {
    if (value < 25) return 'Very Brief';
    if (value < 50) return 'Brief';
    if (value < 75) return 'Detailed';
    return 'Very Detailed';
  };

  const getFormalCasualLabel = (value: number) => {
    if (value < 25) return 'Very Formal';
    if (value < 50) return 'Formal';
    if (value < 75) return 'Casual';
    return 'Very Casual';
  };

  // Generate a sample message based on current tone settings
  const getSampleMessage = (briefDetailed: number, formalCasual: number): string => {
    // Matrix of sample responses to "Can we meet tomorrow?"
    const samples = {
      // Very Brief (0-24)
      veryBrief: {
        veryFormal: "Yes, that would be acceptable.",
        formal: "Yes, tomorrow works for me.",
        casual: "Yeah sure, works for me!",
        veryCasual: "yep! 👍",
      },
      // Brief (25-49)
      brief: {
        veryFormal: "Yes, I am available tomorrow. Please let me know the preferred time.",
        formal: "Tomorrow works for me. What time were you thinking?",
        casual: "Yeah that works! What time?",
        veryCasual: "yeah sounds good, what time works? 😊",
      },
      // Detailed (50-74)
      detailed: {
        veryFormal: "Yes, I would be pleased to meet tomorrow. I have availability in the morning between 9 and 11, or alternatively in the afternoon after 2pm. Please let me know which time would be most convenient for you.",
        formal: "Tomorrow works well for me. I'm free in the morning from 9-11 or in the afternoon after 2pm. Let me know what works best for you.",
        casual: "Yeah tomorrow's great! I'm pretty flexible - free in the morning or after 2. Just let me know what works for you!",
        veryCasual: "yeah totally! im free most of the day tbh, morning or afternoon works... lmk what's good for u! 🙌",
      },
      // Very Detailed (75-100)
      veryDetailed: {
        veryFormal: "Thank you for reaching out regarding a meeting. Yes, I would be pleased to meet with you tomorrow. I have availability in the morning between 9:00 AM and 11:00 AM, or alternatively in the afternoon after 2:00 PM. Please let me know which time slot would be most convenient for your schedule, and I will ensure to block that time accordingly.",
        formal: "Thanks for reaching out! Tomorrow works well for me. I have a few windows of availability - I'm free in the morning from 9-11am, or in the afternoon anytime after 2pm. Let me know what time works best for you and I'll make sure to block it off on my calendar.",
        casual: "Yeah for sure, tomorrow works great for me! I've got some time in the morning between 9 and 11, or basically anytime in the afternoon after 2. Just shoot me a message with what works for you and we can figure out the details!",
        veryCasual: "omg yes!! tomorrow's perfect 🎉 i'm pretty much free whenever tbh... got some time in the morning or like anytime after 2ish in the afternoon. just lmk what works and we'll make it happen haha 😄",
      },
    };

    // Determine length category
    let lengthKey: 'veryBrief' | 'brief' | 'detailed' | 'veryDetailed';
    if (briefDetailed < 25) lengthKey = 'veryBrief';
    else if (briefDetailed < 50) lengthKey = 'brief';
    else if (briefDetailed < 75) lengthKey = 'detailed';
    else lengthKey = 'veryDetailed';

    // Determine style category
    let styleKey: 'veryFormal' | 'formal' | 'casual' | 'veryCasual';
    if (formalCasual < 25) styleKey = 'veryFormal';
    else if (formalCasual < 50) styleKey = 'formal';
    else if (formalCasual < 75) styleKey = 'casual';
    else styleKey = 'veryCasual';

    return samples[lengthKey][styleKey];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Personal Tone of Voice
        </CardTitle>
        <CardDescription>
          Define your preferred communication style. This will be used when generating AI draft suggestions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Analyze Button */}
        <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Analyze Your Messages</p>
            <p className="text-xs text-muted-foreground">
              {cachedMessageCount > 0
                ? `${cachedMessageCount} messages cached from your conversations`
                : 'Fetch messages from your chats to analyze your communication style'}
            </p>
            {settings.lastAnalyzedAt && (
              <p className="text-xs text-muted-foreground">
                Last analyzed: {new Date(settings.lastAnalyzedAt).toLocaleDateString()}
                {settings.analyzedMessageCount && ` (${settings.analyzedMessageCount} messages)`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !hasBeeperToken}
            >
              {isAnalyzing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isAnalyzing ? 'Fetching...' : 'Fetch & Analyze'}
            </Button>
            {cachedMessageCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyzeFromCache}
                disabled={isAnalyzing}
              >
                Re-analyze Cache
              </Button>
            )}
          </div>
          {!hasBeeperToken && (
            <p className="text-xs text-amber-600">
              Configure your Beeper token in API Keys settings to enable analysis
            </p>
          )}
        </div>

        {/* Brief/Detailed Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Message Length</Label>
            <span className="text-sm text-muted-foreground">
              {getBriefDetailedLabel(settings.briefDetailed)}
            </span>
          </div>
          <Slider
            value={[settings.briefDetailed]}
            onValueChange={(value) => handleSliderChange('briefDetailed', value)}
            max={100}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Brief</span>
            <span>Detailed</span>
          </div>
        </div>

        {/* Formal/Casual Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Communication Style</Label>
            <span className="text-sm text-muted-foreground">
              {getFormalCasualLabel(settings.formalCasual)}
            </span>
          </div>
          <Slider
            value={[settings.formalCasual]}
            onValueChange={(value) => handleSliderChange('formalCasual', value)}
            max={100}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Formal</span>
            <span>Casual</span>
          </div>
        </div>

        {/* Sample Message Preview */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Sample Response</Label>
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">To: &quot;Can we meet tomorrow?&quot;</p>
            <p className="text-sm">{getSampleMessage(settings.briefDetailed, settings.formalCasual)}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Your tone preferences are saved automatically and will be used to personalize AI-generated draft suggestions.
        </p>
      </CardContent>
    </Card>
  );
}
