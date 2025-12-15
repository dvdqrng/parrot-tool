'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { loadToneSettings, saveToneSettings, loadCachedUserMessages, saveCachedUserMessages, loadSettings, CachedUserMessage, loadWritingStylePatterns, saveWritingStylePatterns } from '@/lib/storage';
import { ToneSettings as ToneSettingsType, WritingStylePatterns } from '@/lib/types';
import { toast } from 'sonner';

interface ToneAnalysis {
  briefDetailed: number;
  formalCasual: number;
  messageCount: number;
  writingStyle: WritingStylePatterns;
}

// Extract emojis from text using Intl.Segmenter for accurate emoji detection
function extractEmojis(text: string): string[] {
  const emojis: string[] = [];

  // Use Intl.Segmenter if available (modern browsers)
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    for (const { segment } of segmenter.segment(text)) {
      // Check if this grapheme is an emoji by testing against emoji regex
      // This catches all emojis including compound ones like 👨‍👩‍👧‍👦
      if (/\p{Emoji}/u.test(segment) && !/^[0-9#*]$/.test(segment)) {
        emojis.push(segment);
      }
    }
    return emojis;
  }

  // Fallback: use a comprehensive regex for emoji sequences
  // This matches most emojis including ZWJ sequences and skin tone modifiers
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;
  return text.match(emojiRegex) || [];
}

// Common abbreviations to look for
const COMMON_ABBREVIATIONS = [
  'u', 'ur', 'r', 'y', 'k', 'ok', 'bc', 'b4', 'cuz', 'tho', 'thx', 'pls', 'plz',
  'rn', 'imo', 'imho', 'tbh', 'ngl', 'idk', 'idc', 'omg', 'omfg', 'wtf', 'wth',
  'lol', 'lmao', 'rofl', 'brb', 'gtg', 'ttyl', 'ty', 'yw', 'np', 'jk', 'ik',
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'dunno', 'lemme', 'gimme',
  'msg', 'txt', 'pic', 'pics', 'vid', 'vids', 'w/', 'w/o', '&', 'n', 'vs'
];

// Common greeting patterns
const GREETING_PATTERNS = [
  'hey', 'hi', 'hello', 'yo', 'sup', 'whats up', "what's up", 'hiya', 'heya',
  'morning', 'good morning', 'afternoon', 'evening', 'howdy'
];

// Common sign-off patterns
const SIGNOFF_PATTERNS = [
  'thanks', 'thx', 'ty', 'cheers', 'later', 'bye', 'cya', 'ttyl', 'talk soon',
  'take care', 'best', 'regards', 'love', 'xo', 'xx', '❤️', '💕'
];

// Language quirks to detect (pairs of formal vs casual)
const LANGUAGE_QUIRKS_MAP: Record<string, string> = {
  'haha': 'uses "haha"',
  'hehe': 'uses "hehe"',
  'lol': 'uses "lol"',
  'lmao': 'uses "lmao"',
  '...': 'uses ellipsis...',
  '!!': 'uses multiple exclamation!!',
  '??': 'uses multiple question marks??',
  'yeah': 'says "yeah"',
  'yep': 'says "yep"',
  'nope': 'says "nope"',
  'nah': 'says "nah"',
  'cool': 'says "cool"',
  'awesome': 'says "awesome"',
  'nice': 'says "nice"',
  'sounds good': 'says "sounds good"',
  'for sure': 'says "for sure"',
  'def': 'says "def"',
  'totally': 'says "totally"',
  'literally': 'says "literally"',
  'basically': 'says "basically"',
  'honestly': 'says "honestly"',
  'actually': 'says "actually"',
};

function analyzeWritingStyle(messages: { text: string }[]): WritingStylePatterns {
  if (messages.length === 0) {
    return {
      sampleMessages: [],
      commonPhrases: [],
      frequentEmojis: [],
      greetingPatterns: [],
      signOffPatterns: [],
      punctuationStyle: {
        usesMultipleExclamation: false,
        usesEllipsis: false,
        usesAllCaps: false,
        endsWithPunctuation: true,
      },
      capitalizationStyle: 'proper',
      avgWordsPerMessage: 10,
      abbreviations: [],
      languageQuirks: [],
    };
  }

  // Collect stats
  const emojiCounts: Record<string, number> = {};
  const abbreviationCounts: Record<string, number> = {};
  const greetingCounts: Record<string, number> = {};
  const signOffCounts: Record<string, number> = {};
  const quirkCounts: Record<string, number> = {};

  let totalWords = 0;
  let multipleExclamationCount = 0;
  let ellipsisCount = 0;
  let allCapsWordCount = 0;
  let endsWithPunctuationCount = 0;
  let startsWithLowercaseCount = 0;
  let startsWithUppercaseCount = 0;

  // Analyze each message
  for (const msg of messages) {
    const text = msg.text;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    totalWords += words.length;

    // Extract emojis
    const emojis = extractEmojis(text);
    for (const emoji of emojis) {
      emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
    }

    // Check for abbreviations
    const lowerText = text.toLowerCase();
    for (const abbr of COMMON_ABBREVIATIONS) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        abbreviationCounts[abbr] = (abbreviationCounts[abbr] || 0) + matches.length;
      }
    }

    // Check for greetings at start of message
    const firstWords = lowerText.slice(0, 20);
    for (const greeting of GREETING_PATTERNS) {
      if (firstWords.startsWith(greeting)) {
        greetingCounts[greeting] = (greetingCounts[greeting] || 0) + 1;
      }
    }

    // Check for sign-offs at end of message
    const lastWords = lowerText.slice(-30);
    for (const signOff of SIGNOFF_PATTERNS) {
      if (lastWords.includes(signOff)) {
        signOffCounts[signOff] = (signOffCounts[signOff] || 0) + 1;
      }
    }

    // Check for language quirks
    for (const [quirk, description] of Object.entries(LANGUAGE_QUIRKS_MAP)) {
      if (lowerText.includes(quirk)) {
        quirkCounts[description] = (quirkCounts[description] || 0) + 1;
      }
    }

    // Punctuation style
    if (/!{2,}/.test(text)) multipleExclamationCount++;
    if (/\.{3,}|…/.test(text)) ellipsisCount++;
    if (/[.!?]$/.test(text.trim())) endsWithPunctuationCount++;

    // Check for ALL CAPS words (not just single letters)
    const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
    allCapsWordCount += capsWords.length;

    // Capitalization style
    const firstChar = text.trim()[0];
    if (firstChar && /[a-z]/.test(firstChar)) startsWithLowercaseCount++;
    if (firstChar && /[A-Z]/.test(firstChar)) startsWithUppercaseCount++;
  }

  // Sort and get top items
  const sortByCount = (counts: Record<string, number>, limit: number): string[] => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .filter(([, count]) => count >= 2) // Only include if used at least twice
      .map(([item]) => item);
  };

  // Get diverse sample messages (different lengths, styles)
  const sortedByLength = [...messages].sort((a, b) => a.text.length - b.text.length);
  const sampleMessages: string[] = [];

  // Get short, medium, and long examples
  if (sortedByLength.length > 0) {
    const shortIdx = Math.floor(sortedByLength.length * 0.2);
    const medIdx = Math.floor(sortedByLength.length * 0.5);
    const longIdx = Math.floor(sortedByLength.length * 0.8);

    // Add diverse samples, filtering for good examples
    const candidates = [
      sortedByLength[shortIdx],
      sortedByLength[medIdx],
      sortedByLength[longIdx],
      ...messages.slice(0, 20) // Recent messages
    ].filter(m => m && m.text.length > 5 && m.text.length < 500);

    // Pick unique, representative samples
    const seen = new Set<string>();
    for (const msg of candidates) {
      if (!seen.has(msg.text) && sampleMessages.length < 10) {
        seen.add(msg.text);
        sampleMessages.push(msg.text);
      }
    }
  }

  // Determine capitalization style
  let capitalizationStyle: 'proper' | 'lowercase' | 'mixed' = 'mixed';
  if (startsWithUppercaseCount > startsWithLowercaseCount * 2) {
    capitalizationStyle = 'proper';
  } else if (startsWithLowercaseCount > startsWithUppercaseCount * 2) {
    capitalizationStyle = 'lowercase';
  }

  return {
    sampleMessages,
    commonPhrases: [], // Could be enhanced with n-gram analysis
    frequentEmojis: sortByCount(emojiCounts, 10),
    greetingPatterns: sortByCount(greetingCounts, 5),
    signOffPatterns: sortByCount(signOffCounts, 5),
    punctuationStyle: {
      usesMultipleExclamation: multipleExclamationCount > messages.length * 0.1,
      usesEllipsis: ellipsisCount > messages.length * 0.1,
      usesAllCaps: allCapsWordCount > messages.length * 0.05,
      endsWithPunctuation: endsWithPunctuationCount > messages.length * 0.5,
    },
    capitalizationStyle,
    avgWordsPerMessage: Math.round(totalWords / messages.length),
    abbreviations: sortByCount(abbreviationCounts, 15),
    languageQuirks: sortByCount(quirkCounts, 10),
  };
}

function analyzeTone(messages: { text: string }[]): ToneAnalysis {
  if (messages.length === 0) {
    return {
      briefDetailed: 50,
      formalCasual: 50,
      messageCount: 0,
      writingStyle: analyzeWritingStyle([])
    };
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
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, // Emojis
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
    writingStyle: analyzeWritingStyle(messages),
  };
}

export function ToneSettingsSection() {
  const [settings, setSettings] = useState<ToneSettingsType>({
    briefDetailed: 50,
    formalCasual: 50,
  });
  const [writingStyle, setWritingStyle] = useState<WritingStylePatterns | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cachedMessageCount, setCachedMessageCount] = useState(0);
  const [hasBeeperToken, setHasBeeperToken] = useState(false);

  useEffect(() => {
    const loaded = loadToneSettings();
    setSettings(loaded);
    const loadedStyle = loadWritingStylePatterns();
    if (loadedStyle.sampleMessages.length > 0) {
      setWritingStyle(loadedStyle);
    }
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

      // Save the writing style patterns
      setWritingStyle(analysis.writingStyle);
      saveWritingStylePatterns(analysis.writingStyle);

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

    // Save the writing style patterns
    setWritingStyle(analysis.writingStyle);
    saveWritingStylePatterns(analysis.writingStyle);

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
          <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
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
            <p className="text-xs font-medium">Analyze Your Messages</p>
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
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" strokeWidth={1.5} />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" strokeWidth={1.5} />
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
            <span className="text-xs text-muted-foreground">
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
            <span className="text-xs text-muted-foreground">
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
            <p className="text-xs">{getSampleMessage(settings.briefDetailed, settings.formalCasual)}</p>
          </div>
        </div>

        {/* Detected Writing Style Patterns */}
        {writingStyle && (writingStyle.frequentEmojis.length > 0 || writingStyle.abbreviations.length > 0 || writingStyle.languageQuirks.length > 0) && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-muted-foreground">Detected Writing Patterns</Label>
              <p className="text-xs text-muted-foreground mt-1">
                These patterns were found in your messages and will help make AI drafts sound more like you.
              </p>
            </div>

            {/* Emojis */}
            {writingStyle.frequentEmojis.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Your Emojis</p>
                <div className="flex flex-wrap gap-2">
                  {writingStyle.frequentEmojis.map((emoji, i) => (
                    <span
                      key={i}
                      className="text-2xl"
                      role="img"
                      aria-label="emoji"
                      style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Abbreviations */}
            {writingStyle.abbreviations.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Your Abbreviations</p>
                <div className="flex flex-wrap gap-1">
                  {writingStyle.abbreviations.map((abbr, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {abbr}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Language Quirks */}
            {writingStyle.languageQuirks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Your Expressions</p>
                <div className="flex flex-wrap gap-1">
                  {writingStyle.languageQuirks.map((quirk, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {quirk}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Style Summary */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Style Summary</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">
                  ~{writingStyle.avgWordsPerMessage} words/msg
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {writingStyle.capitalizationStyle === 'lowercase' ? 'lowercase style' :
                   writingStyle.capitalizationStyle === 'proper' ? 'Proper Case' : 'Mixed case'}
                </Badge>
                {writingStyle.punctuationStyle.usesEllipsis && (
                  <Badge variant="secondary" className="text-xs">uses...</Badge>
                )}
                {writingStyle.punctuationStyle.usesMultipleExclamation && (
                  <Badge variant="secondary" className="text-xs">uses!!</Badge>
                )}
                {!writingStyle.punctuationStyle.endsWithPunctuation && (
                  <Badge variant="secondary" className="text-xs">skips periods</Badge>
                )}
              </div>
            </div>

            {/* Sample Messages */}
            {writingStyle.sampleMessages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Your Sample Messages</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {writingStyle.sampleMessages.slice(0, 5).map((msg, i) => (
                    <p key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 truncate">
                      &quot;{msg}&quot;
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Your tone preferences are saved automatically and will be used to personalize AI-generated draft suggestions.
        </p>
      </CardContent>
    </Card>
  );
}
