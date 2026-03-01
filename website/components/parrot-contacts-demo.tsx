'use client';

// ============================================
// Self-contained CRM/Contacts demo for the Parrot marketing page.
// Shows a contacts table + selected contact profile panel
// with AI-extracted knowledge.
// ============================================

type Platform = 'instagram' | 'twitter' | 'telegram' | 'whatsapp' | 'linkedin';

interface DemoContact {
  id: string;
  name: string;
  avatar: string;
  company?: string;
  role?: string;
  platforms: Platform[];
  tags: { name: string; color: string }[];
  totalMessages: number;
  lastContact: string;
  selected?: boolean;
}

interface DemoFact {
  category: string;
  iconType: string;
  text: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
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

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
};

// ============================================
// DEMO DATA
// ============================================

const demoContacts: DemoContact[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?img=1',
    company: 'Nike',
    role: 'Partnerships',
    platforms: ['instagram', 'linkedin'],
    tags: [
      { name: 'VIP', color: '#EF4444' },
      { name: 'Brand Partner', color: '#10B981' },
    ],
    totalMessages: 247,
    lastContact: 'Feb 28',
    selected: true,
  },
  {
    id: '2',
    name: 'Mike Torres',
    avatar: 'https://i.pravatar.cc/150?img=3',
    company: 'YouTube',
    role: 'Creator',
    platforms: ['twitter', 'telegram'],
    tags: [
      { name: 'Creator', color: '#8B5CF6' },
      { name: 'Collab', color: '#3B82F6' },
    ],
    totalMessages: 183,
    lastContact: 'Feb 27',
  },
  {
    id: '3',
    name: 'Ryan Oakes',
    avatar: 'https://i.pravatar.cc/150?img=51',
    company: 'CAA',
    role: 'Talent Manager',
    platforms: ['whatsapp', 'instagram'],
    tags: [
      { name: 'Manager', color: '#F97316' },
      { name: 'VIP', color: '#EF4444' },
    ],
    totalMessages: 478,
    lastContact: 'Feb 28',
  },
  {
    id: '4',
    name: 'Jenny Wu',
    avatar: 'https://i.pravatar.cc/150?img=5',
    company: 'Freelance',
    role: 'Photographer',
    platforms: ['telegram', 'instagram'],
    tags: [
      { name: 'Creator', color: '#8B5CF6' },
      { name: 'Friend', color: '#14B8A6' },
    ],
    totalMessages: 89,
    lastContact: 'Feb 25',
  },
  {
    id: '5',
    name: 'Alex Kumar',
    avatar: 'https://i.pravatar.cc/150?img=8',
    platforms: ['whatsapp'],
    tags: [
      { name: 'Superfan', color: '#F59E0B' },
    ],
    totalMessages: 312,
    lastContact: 'Feb 27',
  },
  {
    id: '6',
    name: 'Lisa Park',
    avatar: 'https://i.pravatar.cc/150?img=9',
    company: 'TechPod',
    role: 'Host',
    platforms: ['twitter', 'linkedin'],
    tags: [
      { name: 'Media', color: '#EC4899' },
      { name: 'Podcast', color: '#6366F1' },
    ],
    totalMessages: 56,
    lastContact: 'Feb 22',
  },
  {
    id: '7',
    name: 'Notion',
    avatar: 'https://i.pravatar.cc/150?img=15',
    company: 'Notion',
    role: 'Brand Team',
    platforms: ['instagram'],
    tags: [
      { name: 'Brand Partner', color: '#10B981' },
    ],
    totalMessages: 18,
    lastContact: 'Feb 20',
  },
];

const selectedProfile = {
  contact: demoContacts[0],
  relationshipBadge: 'Brand Partner',
  messagesSent: 105,
  messagesReceived: 142,
  avgResponseTime: '2h',
  aiSummary: 'Brand partnership contact at Nike. Has managed two previous collaborations with strong results. High engagement potential — consistently responsive and proactive about new campaigns.',
  facts: [
    {
      category: 'Location',
      iconType: 'map-pin',
      text: 'Portland, OR',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-100',
    },
    {
      category: 'Role',
      iconType: 'briefcase',
      text: 'Partnerships Manager at Nike',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
    {
      category: 'History',
      iconType: 'star',
      text: 'Previous collab: Q3 2024 shoe campaign ($18K)',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
    {
      category: 'Interest',
      iconType: 'heart',
      text: 'Running, sustainable fashion, creator partnerships',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
      borderColor: 'border-pink-100',
    },
    {
      category: 'Budget',
      iconType: 'briefcase',
      text: 'Authority for creator deals up to $50K',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-100',
    },
  ] as DemoFact[],
  connectedPlatforms: [
    { platform: 'instagram' as Platform, handle: '@sarah.chen.nike' },
    { platform: 'linkedin' as Platform, handle: 'Sarah Chen' },
  ],
};

// ============================================
// SUB-COMPONENTS
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

function TagBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color,
      }}
    >
      {name}
    </span>
  );
}

function ContactRow({ contact }: { contact: DemoContact }) {
  return (
    <tr className={`border-b border-zinc-50 ${contact.selected ? 'bg-blue-50/40' : 'hover:bg-zinc-50/50'}`}>
      {/* Name + Avatar */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-zinc-200 overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-zinc-900 block truncate">{contact.name}</span>
            {contact.company && (
              <span className="text-[10px] text-zinc-400 truncate block">{contact.company}{contact.role ? ` · ${contact.role}` : ''}</span>
            )}
          </div>
        </div>
      </td>
      {/* Platforms */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          {contact.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>
      </td>
      {/* Tags */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-1 flex-wrap">
          {contact.tags.map((tag) => (
            <TagBadge key={tag.name} name={tag.name} color={tag.color} />
          ))}
        </div>
      </td>
      {/* Messages */}
      <td className="py-2 px-2 text-right">
        <span className="text-[11px] text-zinc-500 tabular-nums">{contact.totalMessages}</span>
      </td>
      {/* Last Contact */}
      <td className="py-2 px-2 text-right">
        <span className="text-[11px] text-zinc-400">{contact.lastContact}</span>
      </td>
    </tr>
  );
}

function ProfilePanel() {
  const { contact, aiSummary, facts, connectedPlatforms, relationshipBadge, messagesSent, messagesReceived, avgResponseTime } = selectedProfile;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-zinc-200 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-zinc-900 block">{contact.name}</span>
          <span className="text-xs text-zinc-500">{contact.company}{contact.role ? ` · ${contact.role}` : ''}</span>
        </div>
      </div>

      {/* Relationship Badge */}
      <div>
        <span className="bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 text-[10px] font-medium border border-emerald-100">
          {relationshipBadge}
        </span>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-50 rounded-lg p-2.5">
          <span className="text-lg font-semibold text-zinc-900">{contact.totalMessages}</span>
          <span className="text-[10px] text-zinc-400 block">Total messages</span>
        </div>
        <div className="bg-zinc-50 rounded-lg p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">
              <span className="text-emerald-500 font-medium">{messagesReceived}</span> in
            </span>
            <span className="text-[10px] text-zinc-400">
              <span className="text-blue-500 font-medium">{messagesSent}</span> out
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Sent / Received</span>
        </div>
        <div className="bg-zinc-50 rounded-lg p-2.5">
          <span className="text-xs font-medium text-zinc-700">{contact.lastContact}</span>
          <span className="text-[10px] text-zinc-400 block">Last contacted</span>
        </div>
        <div className="bg-zinc-50 rounded-lg p-2.5">
          <span className="text-xs font-medium text-zinc-700">{avgResponseTime}</span>
          <span className="text-[10px] text-zinc-400 block">Avg response</span>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <BrainIcon className="h-3 w-3 text-violet-600" />
          <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">AI Summary</span>
        </div>
        <p className="text-xs text-zinc-700 leading-relaxed">{aiSummary}</p>
      </div>

      {/* Known Facts */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <SparklesIcon className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Known Facts</span>
        </div>
        <div className="space-y-2">
          {facts.map((fact, i) => (
            <div key={i} className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100 flex items-start gap-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shrink-0 ${fact.bgColor} ${fact.textColor} ${fact.borderColor}`}>
                {fact.iconType === 'map-pin' && <MapPinIcon className="h-2.5 w-2.5" />}
                {fact.iconType === 'briefcase' && <BriefcaseIcon className="h-2.5 w-2.5" />}
                {fact.iconType === 'star' && <StarIcon className="h-2.5 w-2.5" />}
                {fact.iconType === 'heart' && <HeartIcon className="h-2.5 w-2.5" />}
                {fact.category}
              </span>
              <span className="text-xs text-zinc-700">{fact.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TagIcon className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Tags</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {contact.tags.map((tag) => (
            <TagBadge key={tag.name} name={tag.name} color={tag.color} />
          ))}
        </div>
      </div>

      {/* Connected Platforms */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <LinkIcon className="h-3 w-3 text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Connected Platforms</span>
        </div>
        <div className="space-y-1.5">
          {connectedPlatforms.map((cp) => (
            <div key={cp.platform} className="flex items-center gap-2 bg-zinc-50 rounded-lg px-2.5 py-2 border border-zinc-100">
              <PlatformBadge platform={cp.platform} />
              <span className="text-xs text-zinc-700">{platformNames[cp.platform]}</span>
              <span className="text-[10px] text-zinc-400 ml-auto">{cp.handle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN EXPORT
// ============================================

export function ParrotContactsDemo() {
  return (
    <div className="flex flex-col md:flex-row gap-3 h-auto md:h-[520px]">
      {/* Left: Contacts Table */}
      <div className="flex-[3] flex flex-col bg-white rounded-xl overflow-hidden min-w-0">
        {/* Search + Filters */}
        <div className="p-3 border-b border-zinc-100">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex-1 flex items-center gap-2 bg-zinc-50 rounded-lg px-3 py-1.5 border border-zinc-100">
              <SearchIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[11px] text-zinc-400">Search contacts...</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className="bg-zinc-100 rounded-md px-1.5 py-0.5 font-medium">{demoContacts.length}</span>
              <span>contacts</span>
            </div>
          </div>
          {/* Platform filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 mr-1">Filter:</span>
            {(['instagram', 'twitter', 'telegram', 'whatsapp', 'linkedin'] as Platform[]).map((p) => (
              <div key={p} className="flex items-center gap-1 bg-zinc-50 rounded-md px-1.5 py-1 border border-zinc-100 cursor-default">
                <PlatformBadge platform={p} />
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-[10px] font-medium text-zinc-400 uppercase tracking-wider py-2 px-3">Name</th>
                <th className="text-left text-[10px] font-medium text-zinc-400 uppercase tracking-wider py-2 px-2">Channel</th>
                <th className="text-left text-[10px] font-medium text-zinc-400 uppercase tracking-wider py-2 px-2">Tags</th>
                <th className="text-right text-[10px] font-medium text-zinc-400 uppercase tracking-wider py-2 px-2">Msgs</th>
                <th className="text-right text-[10px] font-medium text-zinc-400 uppercase tracking-wider py-2 px-2">Last</th>
              </tr>
            </thead>
            <tbody>
              {demoContacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Contact Profile */}
      <div className="flex-[2] bg-white rounded-xl border border-zinc-200 p-4 overflow-y-auto flex flex-col">
        <ProfilePanel />
      </div>
    </div>
  );
}

// ============================================
// INLINE SVG ICONS
// ============================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
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

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
