'use client';

// ============================================
// Self-contained demo components for the Parrot marketing page.
// Three visually distinct variants:
//   - full: Kanban board (Unread / Drafts / Sent columns)
//   - drafts-focus: Conversation view with AI-drafted reply
//   - context-panel: Message panel + contact intelligence sidebar
//   - platform-view: Kanban grouped by platform with colored accents
// Website version: uses a static CSS orb matching the app's AiOrbButton.
// ============================================

type Platform = 'instagram' | 'twitter' | 'telegram' | 'whatsapp' | 'linkedin';

interface DemoCard {
  id: string;
  name: string;
  avatar: string;
  platform: Platform;
  text: string;
  timeAgo: string;
  unreadCount?: number;
  isGroup?: boolean;
  isDraft?: boolean;
  originalText?: string;
  draftText?: string;
}

interface DemoMessage {
  id: string;
  text: string;
  isFromMe: boolean;
  senderName?: string;
  timestamp: string;
}

interface DemoContactContext {
  name: string;
  company: string;
  platform: Platform;
  avatarUrl: string;
  aiSummary: string;
  facts: Array<{ category: string; iconType: string; text: string; color: string }>;
  relationshipBadge: string;
}

// ============================================
// PLATFORM CONFIG
// ============================================

const platformIcons: Record<string, string> = {
  instagram: '/platforms/instagram.png',
  twitter: '/platforms/x.png',
  telegram: '/platforms/telegram.png',
  whatsapp: '/platforms/whatsapp.png',
  linkedin: '/platforms/linkedin.png',
};

const platformColors: Record<Platform, string> = {
  instagram: '#E4405F',
  twitter: '#000000',
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  linkedin: '#0A66C2',
};

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
};

// ============================================
// KANBAN DEMO DATA
// ============================================

const unreadCards: DemoCard[] = [
  {
    id: 'u1',
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?img=1',
    platform: 'instagram',
    text: "Hey! I've been following your channel for 2 years and your latest video on AI tools completely changed how I work. Would love to collaborate on a design systems video 🎨",
    timeAgo: '12 min ago',
    unreadCount: 2,
  },
  {
    id: 'u2',
    name: 'Mike Torres',
    avatar: 'https://i.pravatar.cc/150?img=3',
    platform: 'twitter',
    text: 'Yo your take on the new MacBook Pro was spot on. Have you tried the M4 Max for video editing? Would love to compare notes',
    timeAgo: '25 min ago',
    unreadCount: 1,
  },
  {
    id: 'u3',
    name: 'Jenny Wu',
    avatar: 'https://i.pravatar.cc/150?img=5',
    platform: 'telegram',
    text: "Quick question - what camera do you use for your B-roll? The quality in your last video was insane",
    timeAgo: '1 hour ago',
    unreadCount: 1,
  },
  {
    id: 'u4',
    name: 'Nike Partnerships',
    avatar: 'https://i.pravatar.cc/150?img=7',
    platform: 'instagram',
    text: "Hi! We're reaching out because we love your content and think our new running line would be perfect for a collaboration. Would you be interested in discussing a partnership?",
    timeAgo: '2 hours ago',
    unreadCount: 1,
  },
  {
    id: 'u5',
    name: 'Alex Kumar',
    avatar: 'https://i.pravatar.cc/150?img=8',
    platform: 'whatsapp',
    text: "Dude the podcast episode you did with MKBHD was legendary. When's the next one?",
    timeAgo: '3 hours ago',
    unreadCount: 3,
  },
  {
    id: 'u6',
    name: 'Lisa Park',
    avatar: 'https://i.pravatar.cc/150?img=9',
    platform: 'twitter',
    text: "I run a tech podcast and we'd love to have you on as a guest. We get about 200K downloads per episode. Interested?",
    timeAgo: '4 hours ago',
    unreadCount: 1,
  },
  {
    id: 'u7',
    name: 'Notion',
    avatar: 'https://i.pravatar.cc/150?img=15',
    platform: 'instagram',
    text: "We noticed you've mentioned Notion in several videos. We'd love to explore a sponsored integration - our team is a big fan of your content!",
    timeAgo: '5 hours ago',
    unreadCount: 1,
  },
  {
    id: 'u8',
    name: 'Carlos Rivera',
    avatar: 'https://i.pravatar.cc/150?img=14',
    platform: 'twitter',
    text: 'Your tutorial on Figma auto-layout saved me HOURS. Just wanted to say thanks 🙏',
    timeAgo: '6 hours ago',
    unreadCount: 1,
  },
];

const draftCards: DemoCard[] = [
  {
    id: 'd1',
    name: 'Amy Liu',
    avatar: 'https://i.pravatar.cc/150?img=16',
    platform: 'linkedin',
    isDraft: true,
    text: '',
    originalText: "Hi! I'm a recruiter at Google and we have an exciting opportunity...",
    draftText: "Thanks Amy! I'm really focused on my creator career right now, but I appreciate you thinking of me. Let's stay connected — I may be interested down the line.",
    timeAgo: '30 min ago',
  },
  {
    id: 'd2',
    name: 'Dev Community',
    avatar: 'https://i.pravatar.cc/150?img=22',
    platform: 'telegram',
    isDraft: true,
    isGroup: true,
    text: '',
    originalText: '@creator When are you doing another live coding session? Last one was fire 🔥',
    draftText: "Thanks for the love! Planning one for next Friday — thinking about building a real-time dashboard. Drop your suggestions below! 🚀",
    timeAgo: '45 min ago',
  },
  {
    id: 'd3',
    name: 'Ryan (Manager)',
    avatar: 'https://i.pravatar.cc/150?img=51',
    platform: 'whatsapp',
    isDraft: true,
    text: '',
    originalText: "Nike wants to do $15K for 2 posts + 1 story. I think we can push for more given your engagement rates.",
    draftText: "Agreed, let's counter at $22K. My last 3 reels averaged 500K views and 8% engagement. Plus they get cross-posting to Twitter which adds another 200K impressions.",
    timeAgo: '1 hour ago',
  },
];

const sentCards: DemoCard[] = [
  {
    id: 's1',
    name: 'Zoe Taylor',
    avatar: 'https://i.pravatar.cc/150?img=25',
    platform: 'instagram',
    text: "Thanks so much! That means a lot 💜 New video dropping Thursday!",
    timeAgo: '2 hours ago',
  },
  {
    id: 's2',
    name: 'Dev Patel',
    avatar: 'https://i.pravatar.cc/150?img=33',
    platform: 'twitter',
    text: "Appreciate the kind words! The lighting setup is actually simpler than you'd think — check my gear list link in bio",
    timeAgo: '3 hours ago',
  },
  {
    id: 's3',
    name: 'Jake Wilson',
    avatar: 'https://i.pravatar.cc/150?img=53',
    platform: 'whatsapp',
    text: "Haha yeah that shoot was wild. Let's do it again next month 📸",
    timeAgo: '5 hours ago',
  },
];

// ============================================
// CONVERSATION DEMO DATA
// ============================================

const conversation1: DemoMessage[] = [
  {
    id: 'c1-1',
    text: "Hey! Love your content. Quick question - what camera setup do you use for your B-roll? The quality is insane",
    isFromMe: false,
    senderName: 'Jenny Wu',
    timestamp: '2:34 PM',
  },
  {
    id: 'c1-2',
    text: "Also do you shoot in 4K or 1080?",
    isFromMe: false,
    senderName: 'Jenny Wu',
    timestamp: '2:35 PM',
  },
];

const conversation1Draft = "Thanks! I shoot B-roll on the Sony A7IV with a 35mm f/1.4. Always 4K \u2014 the crop flexibility in post is worth it. What are you shooting on?";

const conversation2: DemoMessage[] = [
  {
    id: 'c2-1',
    text: "Hi! We loved your latest review. We're launching a new product line next month and think you'd be a perfect fit for a collab",
    isFromMe: false,
    senderName: 'Sarah Chen',
    timestamp: '11:02 AM',
  },
  {
    id: 'c2-2',
    text: "Would you be open to a 30-min call to discuss?",
    isFromMe: false,
    senderName: 'Sarah Chen',
    timestamp: '11:03 AM',
  },
  {
    id: 'c2-3',
    text: "Hey Sarah! Thanks for reaching out. I'd love to hear more about it",
    isFromMe: true,
    timestamp: '11:45 AM',
  },
  {
    id: 'c2-4',
    text: "Great! How does Thursday at 2pm PT work?",
    isFromMe: false,
    senderName: 'Sarah Chen',
    timestamp: '11:47 AM',
  },
];

const sarahChenContext: DemoContactContext = {
  name: 'Sarah Chen',
  company: 'Nike Partnerships',
  platform: 'instagram',
  avatarUrl: 'https://i.pravatar.cc/150?img=1',
  aiSummary: 'Brand partnership contact. Has reached out twice before about sponsored content. High engagement potential.',
  facts: [
    { category: 'Location', iconType: 'map-pin', text: 'Portland, OR', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { category: 'Role', iconType: 'briefcase', text: 'Partnerships Manager at Nike', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { category: 'History', iconType: 'star', text: 'Previous collab: Q3 2024 shoe campaign', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  ],
  relationshipBadge: 'Brand Partner',
};

// ============================================
// HERO CONVERSATION DATA (shown in message panel alongside kanban)
// ============================================

const heroConversation: DemoMessage[] = [
  {
    id: 'h1',
    text: "Hey! I've been following your channel for 2 years and your latest video on AI tools completely changed how I work. Would love to collaborate on a design systems video 🎨",
    isFromMe: false,
    senderName: 'Sarah Chen',
    timestamp: '3:12 PM',
  },
  {
    id: 'h2',
    text: "I have a few ideas for the video format if you're open to it",
    isFromMe: false,
    senderName: 'Sarah Chen',
    timestamp: '3:13 PM',
  },
  {
    id: 'h3',
    text: "Hey Sarah! Love your work — been a fan of your design content too. A collab sounds awesome",
    isFromMe: true,
    timestamp: '3:45 PM',
  },
  {
    id: 'h4',
    text: "What did you have in mind?",
    isFromMe: true,
    timestamp: '3:45 PM',
  },
];

// ============================================
// STATIC ORB (matches AiOrbButton visuals without framer-motion)
// ============================================

type StaticOrbState = 'idle' | 'listening' | 'thinking' | 'learning' | 'ready';

const STATIC_ORB_COLORS: Record<StaticOrbState, { dot: string; lit: string; center: string }> = {
  idle:      { dot: '#7C3AED', lit: '#A78BFA', center: '#8B5CF6' },
  listening: { dot: '#8B5CF6', lit: '#C084FC', center: '#A855F7' },
  thinking:  { dot: '#6366F1', lit: '#60A5FA', center: '#818CF8' },
  learning:  { dot: '#A855F7', lit: '#FBBF24', center: '#F59E0B' },
  ready:     { dot: '#6366F1', lit: '#34D399', center: '#10B981' },
};

function StaticOrb({ state = 'idle', size = 'sm' }: { state?: StaticOrbState; size?: 'sm' | 'md' }) {
  const sizeMap = { sm: 24, md: 28 };
  const px = sizeMap[size];
  const colors = STATIC_ORB_COLORS[state];
  const cx = px / 2;
  const cy = px / 2;
  const r1 = px * 0.15;
  const r2 = px * 0.28;
  const r3 = px * 0.42;
  const dotSize = px * 0.08;

  const dots: Array<{ x: number; y: number; r: number; o: number; fill: string }> = [];
  // Center dot uses center color
  dots.push({ x: cx, y: cy, r: dotSize * 1.3, o: 1, fill: colors.center });
  // Ring 1: 6 dots — alternating dot/lit colors
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    dots.push({ x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1, r: dotSize, o: 0.9, fill: i % 2 === 0 ? colors.lit : colors.dot });
  }
  // Ring 2: 10 dots
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    dots.push({ x: cx + Math.cos(a) * r2, y: cy + Math.sin(a) * r2, r: dotSize * 0.85, o: 0.7, fill: i % 3 === 0 ? colors.lit : colors.dot });
  }
  // Ring 3: 14 dots
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
    dots.push({ x: cx + Math.cos(a) * r3, y: cy + Math.sin(a) * r3, r: dotSize * 0.7, o: 0.5, fill: i % 4 === 0 ? colors.lit : colors.dot });
  }

  return (
    <div className="shrink-0 rounded-full" style={{ width: px, height: px }}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.fill} opacity={d.o} />
        ))}
      </svg>
    </div>
  );
}

// ============================================
// SHARED SUB-COMPONENTS
// ============================================

function PlatformBadge({ platform }: { platform: Platform }) {
  const src = platformIcons[platform] || '/platforms/default.png';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={platform}
      className={platform === 'whatsapp' ? 'h-3 w-3' : 'h-3.5 w-3.5'}
    />
  );
}

function MessageCardUI({ card }: { card: DemoCard }) {
  if (card.isDraft) {
    return (
      <div className="group flex gap-3 p-3 cursor-pointer rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden w-80">
        <div className="relative shrink-0 self-start">
          <div className="h-10 w-10 rounded-full bg-zinc-200 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.avatar} alt={card.name} className="h-full w-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
            <PlatformBadge platform={card.platform} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between h-5">
            <span className="truncate text-xs font-medium text-zinc-900">{card.name}</span>
          </div>
          <p className="text-xs text-zinc-500">{card.originalText}</p>
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-zinc-900">{card.draftText}</p>
          </div>
          <span className="text-xs text-zinc-400 mt-1 block">{card.timeAgo}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3 p-3 cursor-pointer rounded-2xl bg-white hover:shadow-md transition-all overflow-hidden w-80">
      <div className="relative shrink-0 self-start">
        <div className="h-10 w-10 rounded-full bg-zinc-200 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.avatar} alt={card.name} className="h-full w-full object-cover" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
          <PlatformBadge platform={card.platform} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between h-5">
          <span className="truncate text-xs font-medium text-zinc-900">{card.name}</span>
          <div className="flex items-center gap-1 h-5">
            {card.unreadCount && card.unreadCount >= 1 && (
              <span className="ml-1 shrink-0 h-5 min-w-5 flex items-center justify-center rounded-full bg-zinc-100 px-1.5 text-xs font-medium text-zinc-500">
                {card.unreadCount}
              </span>
            )}
          </div>
        </div>
        <p className="line-clamp-2 text-xs text-zinc-500">{card.text}</p>
        <span className="text-xs text-zinc-400">{card.timeAgo}</span>
      </div>
    </div>
  );
}

function ColumnHeaderUI({ title, icon: Icon, count }: { title: string; icon: React.FC<{ className?: string }>; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-400" />
        <h3 className="text-xs font-medium text-zinc-600">{title}</h3>
      </div>
      {title === 'Unread' && count > 0 && (
        <button className="h-6 px-2 text-xs text-zinc-500 hover:bg-zinc-100 rounded-md transition-colors">
          Draft All
        </button>
      )}
      {title === 'Drafts' && count > 0 && (
        <button className="h-6 px-2 text-xs text-zinc-500 hover:bg-zinc-100 rounded-md transition-colors">
          Send All
        </button>
      )}
    </div>
  );
}

// ============================================
// VARIANT: KANBAN VIEW (full — board + message panel)
// ============================================

function KanbanView({ maxCards }: { maxCards?: number }) {
  return (
    <div className="flex gap-0 overflow-hidden">
      {/* Kanban columns — scrollable area taking remaining space */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="flex gap-0">
          <div className="shrink-0 flex flex-col">
            <ColumnHeaderUI title="Unread" icon={InboxIcon} count={unreadCards.length} />
            <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
              {(maxCards ? unreadCards.slice(0, maxCards) : unreadCards).map((card) => (
                <MessageCardUI key={card.id} card={card} />
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col">
            <ColumnHeaderUI title="Drafts" icon={EditIcon} count={draftCards.length} />
            <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
              {draftCards.map((card) => (
                <MessageCardUI key={card.id} card={card} />
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col">
            <ColumnHeaderUI title="Sent" icon={SendIcon} count={sentCards.length} />
            <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
              {(maxCards ? sentCards.slice(0, maxCards) : sentCards).map((card) => (
                <MessageCardUI key={card.id} card={card} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Message panel — sticky on the right, never scrolls away */}
      <div className="shrink-0 w-80 flex flex-col bg-white rounded-2xl shadow-lg ml-2 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-zinc-100">
          <div className="h-9 w-9 rounded-full bg-zinc-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.pravatar.cc/150?img=1" alt="Sarah Chen" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-zinc-900 block">Sarah Chen</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PlatformBadge platform="instagram" />
              <span className="text-[10px] text-zinc-400">Instagram</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="h-6 w-6 rounded-md flex items-center justify-center bg-zinc-100">
              <PanelRightIcon className="h-3 w-3 text-zinc-400" />
            </div>
            <div className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-zinc-100 transition-colors cursor-pointer">
              <XIcon className="h-3 w-3 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
          {heroConversation.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.isFromMe
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100'
              }`}>
                <p className="text-[11px] leading-relaxed">{msg.text}</p>
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 px-1">{msg.timestamp}</span>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-100 p-3">
          <div className="bg-zinc-50 rounded-lg px-3 py-2 text-[11px] text-zinc-400 border border-zinc-100 mb-2">
            Type your reply...
          </div>
          <div className="flex items-center gap-2">
            <StaticOrb state="listening" size="sm" />
            <div className="flex-1" />
            <button className="bg-zinc-200 text-zinc-400 rounded-lg px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5">
              <SendIcon className="h-3 w-3" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VARIANT: CONVERSATION + AI DRAFT (drafts-focus)
// ============================================

function ConversationDraftView() {
  return (
    <div className="flex flex-col h-[480px] bg-white rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-100">
        <div className="h-9 w-9 rounded-full bg-zinc-200 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://i.pravatar.cc/150?img=5" alt="Jenny Wu" className="h-full w-full object-cover" />
        </div>
        <div>
          <span className="text-xs font-medium text-zinc-900">Jenny Wu</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <PlatformBadge platform="telegram" />
            <span className="text-xs text-zinc-400">Telegram</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {conversation1.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.isFromMe
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100'
            }`}>
              <p className="text-xs leading-relaxed">{msg.text}</p>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
      </div>

      {/* AI Draft */}
      <div className="p-4 border-t border-zinc-100">
        <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-2">
            <SparklesIcon className="h-3 w-3 text-blue-600" />
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">AI Draft</span>
          </div>
          <p className="text-xs text-zinc-800 leading-relaxed">{conversation1Draft}</p>
        </div>
        <div className="flex items-center gap-2.5 mt-3">
          <StaticOrb state="ready" size="sm" />
          <div className="flex-1" />
          <button className="bg-zinc-900 text-white rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-800 transition-colors">
            <SendIcon className="h-3 w-3" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VARIANT: MESSAGE PANEL + CONTEXT (context-panel)
// ============================================

function MessagePanelWithContextView() {
  return (
    <div className="flex flex-col md:flex-row gap-3 h-auto md:h-[480px]">
      {/* Left: Conversation */}
      <div className="flex-[3] flex flex-col bg-white rounded-xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-100">
          <div className="h-9 w-9 rounded-full bg-zinc-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sarahChenContext.avatarUrl} alt={sarahChenContext.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-zinc-900">{sarahChenContext.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PlatformBadge platform={sarahChenContext.platform} />
              <span className="text-xs text-zinc-400">Instagram</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-zinc-100 transition-colors cursor-pointer">
              <PanelRightIcon className="h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {conversation2.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.isFromMe
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100'
              }`}>
                <p className="text-xs leading-relaxed">{msg.text}</p>
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}
        </div>

        {/* Input placeholder */}
        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-2.5">
            <StaticOrb state="thinking" size="sm" />
            <div className="flex-1 bg-zinc-50 rounded-lg px-3 py-2 text-xs text-zinc-400 border border-zinc-100">
              Type your reply...
            </div>
            <button className="bg-zinc-200 text-zinc-400 rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-1.5">
              <SendIcon className="h-3 w-3" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right: Context panel */}
      <div className="flex-[2] bg-white rounded-xl border border-zinc-200 p-4 overflow-y-auto flex flex-col gap-4">
        {/* Contact header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-zinc-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sarahChenContext.avatarUrl} alt={sarahChenContext.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-zinc-900 block">{sarahChenContext.name}</span>
            <span className="text-xs text-zinc-500">{sarahChenContext.company}</span>
          </div>
          <PlatformBadge platform={sarahChenContext.platform} />
        </div>

        {/* Relationship badge */}
        <div>
          <span className="bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 text-xs font-medium border border-emerald-100">
            {sarahChenContext.relationshipBadge}
          </span>
        </div>

        {/* AI Summary */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BrainIcon className="h-3 w-3 text-violet-600" />
            <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">AI Summary</span>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed">{sarahChenContext.aiSummary}</p>
        </div>

        {/* Known facts */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <SparklesIcon className="h-3 w-3 text-zinc-400" />
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Known Facts</span>
          </div>
          <div className="space-y-2">
            {sarahChenContext.facts.map((fact, i) => (
              <div key={i} className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100 flex items-start gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shrink-0 ${fact.color}`}>
                  {fact.iconType === 'map-pin' && <MapPinIcon className="h-2.5 w-2.5" />}
                  {fact.iconType === 'briefcase' && <BriefcaseIcon className="h-2.5 w-2.5" />}
                  {fact.iconType === 'star' && <StarIcon className="h-2.5 w-2.5" />}
                  {fact.category}
                </span>
                <span className="text-xs text-zinc-700">{fact.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 transition-colors">
              <EditIcon className="h-3 w-3" />
              Draft Reply
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 transition-colors">
              <ClockIcon className="h-3 w-3" />
              Set Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// VARIANT: PLATFORM VIEW (platform-view)
// ============================================

function PlatformView({ maxCards }: { maxCards?: number }) {
  const allCards = [...unreadCards, ...draftCards.map(d => ({ ...d, text: d.draftText || d.text, isDraft: false })), ...sentCards];
  const platformOrder: Platform[] = ['instagram', 'twitter', 'telegram', 'whatsapp', 'linkedin'];

  const byPlatform: Record<string, DemoCard[]> = {};
  for (const p of platformOrder) byPlatform[p] = [];
  for (const card of allCards) {
    if (byPlatform[card.platform]) byPlatform[card.platform].push(card);
  }

  return (
    <div className="flex gap-0 overflow-x-auto">
      {platformOrder.map((platform) => {
        const cards = byPlatform[platform] || [];
        const color = platformColors[platform];
        return (
          <div key={platform} className="shrink-0 flex flex-col">
            {/* Platform header */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
              >
                <PlatformBadge platform={platform} />
              </div>
              <h3 className="text-xs font-semibold text-zinc-700">{platformNames[platform]}</h3>
              <span className="text-xs text-zinc-400 ml-auto tabular-nums">{cards.length}</span>
            </div>
            {/* Color accent strip */}
            <div
              className="h-0.5 mx-4 rounded-full mb-2"
              style={{ backgroundColor: color }}
            />
            {/* Cards */}
            <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
              {(maxCards ? cards.slice(0, maxCards) : cards).map((card) => (
                <MessageCardUI key={card.id} card={card} />
              ))}
              {cards.length === 0 && (
                <div className="w-80 p-4 rounded-2xl border border-dashed border-zinc-200 text-center">
                  <span className="text-xs text-zinc-400">No messages</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// MAIN EXPORTED COMPONENT
// ============================================

interface ParrotKanbanDemoProps {
  variant?: 'full' | 'unread-only' | 'drafts-focus' | 'platform-view' | 'context-panel';
  className?: string;
  maxCards?: number;
}

export function ParrotKanbanDemo({ variant = 'full', className = '', maxCards }: ParrotKanbanDemoProps) {
  switch (variant) {
    case 'drafts-focus':
      return (
        <div className={className}>
          <ConversationDraftView />
        </div>
      );
    case 'context-panel':
      return (
        <div className={className}>
          <MessagePanelWithContextView />
        </div>
      );
    case 'platform-view':
      return (
        <div className={className}>
          <PlatformView maxCards={maxCards} />
        </div>
      );
    case 'full':
    default:
      return (
        <div className={className}>
          <KanbanView maxCards={maxCards} />
        </div>
      );
  }
}

// ============================================
// INLINE SVG ICONS
// ============================================

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function PanelRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
