'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Key, MessageSquare, Layers, EyeOff, Database, Brain, User, LucideIcon, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/settings-context';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  requiresAi?: boolean;
}

function VersionInfo() {
  const [version, setVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Get version on mount
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.getAppVersion().then(setVersion);

      // Listen for update status
      const unsubscribe = window.electron.onUpdateStatus((status) => {
        setUpdateStatus(status.status);
        if (status.version) setUpdateVersion(status.version);
        if (status.status !== 'checking') setIsChecking(false);
      });

      return unsubscribe;
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electron) {
      setIsChecking(true);
      await window.electron.checkForUpdates();
    }
  };

  const handleInstallUpdate = () => {
    if (window.electron) {
      window.electron.installUpdate();
    }
  };

  // Don't render if not in Electron
  if (!version) return null;

  return (
    <div className="border-t pt-4 mt-4">
      <div className="px-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Version</span>
          <span className="text-xs font-mono">{version}</span>
        </div>

        {updateStatus === 'downloaded' && updateVersion ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
            onClick={handleInstallUpdate}
          >
            <Download className="h-3 w-3 mr-1" />
            Install v{updateVersion}
          </Button>
        ) : updateStatus === 'downloading' ? (
          <div className="text-xs text-muted-foreground text-center">
            Downloading update...
          </div>
        ) : updateStatus === 'available' && updateVersion ? (
          <div className="text-xs text-muted-foreground text-center">
            v{updateVersion} available
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-7"
            onClick={handleCheckForUpdates}
            disabled={isChecking}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isChecking && "animate-spin")} />
            {isChecking ? 'Checking...' : 'Check for updates'}
          </Button>
        )}
      </div>
    </div>
  );
}

const navItems: NavItem[] = [
  {
    title: 'Account',
    href: '/settings/account',
    icon: User,
    description: 'Account & subscription',
  },
  {
    title: 'API Keys',
    href: '/settings/api-keys',
    icon: Key,
    description: 'Configure API keys',
    requiresAi: true,
  },
  {
    title: 'Tone of Voice',
    href: '/settings/tone',
    icon: MessageSquare,
    description: 'Personal communication style',
    requiresAi: true,
  },
  {
    title: 'Autopilot',
    href: '/settings/autopilot',
    icon: Brain,
    description: 'AI agents for auto-replies',
    requiresAi: true,
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
  const { settings } = useSettingsContext();

  // Check if AI features are enabled (default to true for backwards compatibility)
  const aiEnabled = settings.aiEnabled !== false;

  // Filter nav items based on AI enabled state
  const visibleNavItems = navItems.filter(item => !item.requiresAi || aiEnabled);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen w-64 border-r bg-muted/30 p-4 pt-10">
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
              {visibleNavItems.map((item) => {
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

            {/* Version info */}
            <VersionInfo />
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
