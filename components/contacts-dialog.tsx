'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Users, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { useSettingsContext } from '@/contexts/settings-context';
import type { Contact } from '@/app/api/beeper/contacts/route';

interface ContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContact: (contact: Contact) => void;
}

// Convert file:// URLs to proxied API URLs
function getAvatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('file://')) {
    return `/api/avatar?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function ContactsDialog({ open, onOpenChange, onSelectContact }: ContactsDialogProps) {
  const { settings } = useSettingsContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Track if component should be visible (for animation)
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Small delay to ensure element is in DOM before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
        setSearchQuery('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Fetch contacts when dialog opens
  useEffect(() => {
    if (!open) return;

    // Focus input when opened
    setTimeout(() => inputRef.current?.focus(), 100);

    async function fetchContacts() {
      console.log('[ContactsDialog] Fetching contacts...');
      setIsLoading(true);
      setError(null);

      try {
        const headers: HeadersInit = {};
        if (settings.beeperAccessToken) {
          headers['x-beeper-token'] = settings.beeperAccessToken;
        }

        const params = new URLSearchParams();
        if (settings.selectedAccountIds.length > 0) {
          params.set('accountIds', settings.selectedAccountIds.join(','));
        }

        const response = await fetch(`/api/beeper/contacts?${params}`, { headers });
        const result = await response.json();

        console.log('[ContactsDialog] Received contacts:', result.data?.length, 'contacts');
        // Log first few contacts to debug
        if (result.data?.length > 0) {
          console.log('[ContactsDialog] First 5 contacts:', result.data.slice(0, 5).map((c: { name: string; chatId: string }) => ({ name: c.name, chatId: c.chatId })));
        }

        if (result.error) {
          setError(result.error);
        } else {
          setContacts(result.data || []);
        }
      } catch {
        setError('Failed to fetch contacts');
      } finally {
        setIsLoading(false);
      }
    }

    fetchContacts();
  }, [open, settings.beeperAccessToken, settings.selectedAccountIds]);

  // Filter contacts based on search query (client-side for instant filtering)
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact =>
      contact.name.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const handleSelectContact = (contact: Contact) => {
    onSelectContact(contact);
    onOpenChange(false);
  };

  // Close on escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Blurred backdrop */}
      <div
        className={`fixed inset-0 -z-10 bg-background/60 backdrop-blur-sm transition-opacity duration-150 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog - positioned relative to parent (bottom nav wrapper) */}
      <div
        className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[420px] h-[400px] bg-card border rounded-3xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-xs font-medium">New Message</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Search input */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            ref={inputRef}
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-full"
          />
        </div>
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-xs text-destructive">
            {error}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {searchQuery ? 'No contacts found' : 'No recent contacts'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredContacts.map((contact) => {
              const initials = contact.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <Button
                  key={contact.chatId}
                  variant="ghost"
                  onClick={() => handleSelectContact(contact)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 h-auto justify-start"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={getAvatarSrc(contact.avatarUrl)}
                        alt={contact.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xs">
                        {contact.isGroup ? <Users className="h-4 w-4" strokeWidth={1.5} /> : initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                      <PlatformIcon platform={contact.platform} className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium text-xs">{contact.name}</div>
                    {contact.isGroup && (
                      <div className="text-xs text-muted-foreground">Group</div>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
