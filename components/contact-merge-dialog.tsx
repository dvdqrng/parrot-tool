'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CrmContactProfile, CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { getAvatarSrc } from '@/components/message-panel/utils';
import { Search, Link2, ArrowRight } from 'lucide-react';

interface ContactMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContact: CrmContactProfile | null;
  allContacts: Record<string, CrmContactProfile>;
  tags: Record<string, CrmTag>;
  onMerge: (targetContactId: string, sourceContactId: string) => void;
  onLinkNewPlatform?: (sourceContactId: string, chatId: string, platform: string, accountId: string, displayName: string, avatarUrl?: string) => void;
}

export function ContactMergeDialog({
  open,
  onOpenChange,
  sourceContact,
  allContacts,
  tags,
  onMerge,
  onLinkNewPlatform,
}: ContactMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<CrmContactProfile | null>(null);

  // Filter contacts (exclude source contact and search by name)
  const filteredContacts = useMemo(() => {
    if (!sourceContact) return [];

    return Object.values(allContacts)
      .filter(c => c.id !== sourceContact.id)
      .filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          c.displayName.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allContacts, sourceContact, searchQuery]);

  const handleMerge = useCallback(() => {
    if (!sourceContact || !selectedContact) return;
    onMerge(selectedContact.id, sourceContact.id);
    onOpenChange(false);
    setSelectedContact(null);
    setSearchQuery('');
  }, [sourceContact, selectedContact, onMerge, onOpenChange]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (!sourceContact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Merge Contacts
          </DialogTitle>
          <DialogDescription>
            Merge {sourceContact.displayName} with another contact. All platform links and tags will be combined.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Source contact preview */}
          <div className="p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-2">Merging from:</div>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={getAvatarSrc(sourceContact.avatarUrl)}
                  alt={sourceContact.displayName}
                  className="object-cover"
                />
                <AvatarFallback>{getInitials(sourceContact.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{sourceContact.displayName}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {sourceContact.platformLinks.map(link => {
                    const platformInfo = getPlatformInfo(link.platform);
                    return (
                      <Badge
                        key={link.chatId}
                        variant="outline"
                        className="text-xs"
                        style={{
                          backgroundColor: `${platformInfo.color}15`,
                          borderColor: `${platformInfo.color}40`,
                          color: platformInfo.color,
                        }}
                      >
                        {platformInfo.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts to merge into..."
              className="pl-9"
            />
          </div>

          {/* Target contact list */}
          <ScrollArea className="h-[300px] rounded-lg border">
            <div className="p-2 space-y-1">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {searchQuery ? 'No contacts found' : 'No other contacts available'}
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedContact?.id === contact.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={getAvatarSrc(contact.avatarUrl)}
                          alt={contact.displayName}
                          className="object-cover"
                        />
                        <AvatarFallback>{getInitials(contact.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{contact.displayName}</div>
                        {(contact.email || contact.company) && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {contact.email && contact.company
                              ? `${contact.email} • ${contact.company}`
                              : contact.email || contact.company}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.platformLinks.map(link => {
                            const platformInfo = getPlatformInfo(link.platform);
                            return (
                              <Badge
                                key={link.chatId}
                                variant="outline"
                                className="text-xs"
                                style={{
                                  backgroundColor: `${platformInfo.color}15`,
                                  borderColor: `${platformInfo.color}40`,
                                  color: platformInfo.color,
                                }}
                              >
                                {platformInfo.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedContact && (
            <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/30">
              <div className="text-xs text-muted-foreground mb-1">Merging into:</div>
              <div className="font-medium">{selectedContact.displayName}</div>
              <div className="text-xs text-muted-foreground mt-1">
                All platform links, tags, and contact info will be combined
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!selectedContact}>
            Merge Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
