'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Key, MessageSquare, Layers, EyeOff, Database, Brain, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems: { title: string; href: string; icon: LucideIcon; description: string }[] = [
  {
    title: 'API Keys',
    href: '/settings/api-keys',
    icon: Key,
    description: 'Configure API keys',
  },
  {
    title: 'Tone of Voice',
    href: '/settings/tone',
    icon: MessageSquare,
    description: 'Personal communication style',
  },
  {
    title: 'Autopilot',
    href: '/settings/autopilot',
    icon: Brain,
    description: 'AI agents for auto-replies',
  },
  {
    title: 'Platforms',
    href: '/settings/platforms',
    icon: Layers,
    description: 'Connected messaging platforms',
  },
  {
    title: 'Hidden Chats',
    href: '/settings/hidden-chats',
    icon: EyeOff,
    description: 'Manage hidden conversations',
  },
  {
    title: 'Data',
    href: '/settings/data',
    icon: Database,
    description: 'Manage stored data',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen w-64 border-r bg-muted/30 p-4">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                </Button>
              </Link>
              <div>
                <h1 className="text-xs font-medium">Settings</h1>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" strokeWidth={2} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-2xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
