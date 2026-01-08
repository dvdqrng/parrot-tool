'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Search, Link2, ArrowRight, Loader2 } from 'lucide-react';
import type { Contact } from '@/app/api/beeper/contacts/route';
import { loadSettings } from '@/lib/storage';

interface ContactMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContact: CrmContactProfile | null;
  allContacts: Record<string, CrmContactProfile>;
  tags: Record<string, CrmTag>;
  onMerge: (targetContactId: string, sourceContactId: string) => void;
  onLinkNewPlatform?: (sourceContactId: string, chatId: string, platform: string, accountId: string, displayName: string, avatarUrl?: string) => void;
}

// Beeper contact from API (not yet in CRM)
interface BeeperContactOption {
  type: 'beeper';
  chatId: string;
  name: string;
  platform: string;
  accountId: string;
  avatarUrl?: string;
}

// CRM contact option
interface CrmContactOption {
  type: 'crm';
  contact: CrmContactProfile;
}

type ContactOption = BeeperContactOption | CrmContactOption;

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
  const [selectedOption, setSelectedOption] = useState<ContactOption | null>(null);
  const [beeperContacts, setBeeperContacts] = useState<Contact[]>([]);
  const [isLoadingBeeper, setIsLoadingBeeper] = useState(false);

  // Get chat IDs already linked to source contact
  const linkedChatIds = useMemo(() => {
    if (!sourceContact) return new Set<string>();
    return new Set(sourceContact.platformLinks.map(link => link.chatId));
  }, [sourceContact]);

  // Fetch Beeper contacts when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoadingBeeper(true);

      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      fetch('/api/beeper/contacts', { headers })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setBeeperContacts(data.data);
          }
        })
        .catch(() => {
          // Ignore errors
        })
        .finally(() => {
          setIsLoadingBeeper(false);
        });
    } else {
      // Reset state when dialog closes
      setSearchQuery('');
      setSelectedOption(null);
    }
  }, [open]);

  // Filter CRM contacts (exclude source contact)
  const availableCrmContacts = useMemo(() => {
    if (!sourceContact) return [];

    return Object.values(allContacts)
      .filter(c => c.id !== sourceContact.id)
      .filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          c.displayName.toLowerCase().includes(query) ||
          c.nickname?.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query) ||
          c.platformLinks.some(l => l.displayName?.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allContacts, sourceContact, searchQuery]);

  // Filter Beeper contacts (exclude already linked chats and chats that are in CRM contacts)
  const availableBeeperContacts = useMemo(() => {
    if (!sourceContact || !searchQuery) return [];

    // Get all chat IDs that are already in CRM
    const crmChatIds = new Set<string>();
    Object.values(allContacts).forEach(contact => {
      contact.platformLinks.forEach(link => {
        crmChatIds.add(link.chatId);
      });
    });

    const query = searchQuery.toLowerCase();
    return beeperContacts
      .filter(c => !linkedChatIds.has(c.chatId)) // Not already linked to source
      .filter(c => !crmChatIds.has(c.chatId)) // Not in any CRM contact
      .filter(c => c.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20); // Limit results
  }, [beeperContacts, sourceContact, searchQuery, linkedChatIds, allContacts]);

  // Calculate similarity scores for CRM suggestions
  const suggestedCrmContacts = useMemo(() => {
    if (!sourceContact) return [];

    const sourceName = sourceContact.displayName.toLowerCase();
    const sourceNameParts = sourceName.split(/\s+/);

    return Object.values(allContacts)
      .filter(c => c.id !== sourceContact.id)
      .map(contact => {
        let score = 0;
        const targetName = contact.displayName.toLowerCase();
        const targetNameParts = targetName.split(/\s+/);

        // Exact name match
        if (sourceName === targetName) score += 100;

        // Partial name matches
        for (const part of sourceNameParts) {
          if (part.length > 2 && targetName.includes(part)) score += 30;
        }
        for (const part of targetNameParts) {
          if (part.length > 2 && sourceName.includes(part)) score += 30;
        }

        // Same platform links suggest NOT the same person (already linked)
        const sourcePlatforms = new Set(sourceContact.platformLinks.map(l => l.platform));
        const targetPlatforms = new Set(contact.platformLinks.map(l => l.platform));
        const differentPlatforms = [...sourcePlatforms].filter(p => !targetPlatforms.has(p)).length;
        if (differentPlatforms > 0) score += 20; // Bonus for different platforms

        return { contact, score };
      })
      .filter(({ score }) => score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ contact }) => contact);
  }, [allContacts, sourceContact]);

  const handleAction = useCallback(() => {
    if (!sourceContact || !selectedOption) return;

    if (selectedOption.type === 'crm') {
      // Merge with existing CRM contact
      onMerge(selectedOption.contact.id, sourceContact.id);
    } else if (selectedOption.type === 'beeper' && onLinkNewPlatform) {
      // Link new platform chat to source contact
      onLinkNewPlatform(
        sourceContact.id,
        selectedOption.chatId,
        selectedOption.platform,
        selectedOption.accountId,
        selectedOption.name,
        selectedOption.avatarUrl
      );
    }

    onOpenChange(false);
    setSelectedOption(null);
    setSearchQuery('');
  }, [sourceContact, selectedOption, onMerge, onLinkNewPlatform, onOpenChange]);

  // Get display info for selected option
  const selectedDisplay = useMemo(() => {
    if (!selectedOption) return null;
    if (selectedOption.type === 'crm') {
      return {
        name: selectedOption.contact.displayName,
        avatarUrl: selectedOption.contact.avatarUrl,
        platforms: selectedOption.contact.platformLinks,
      };
    } else {
      return {
        name: selectedOption.name,
        avatarUrl: selectedOption.avatarUrl,
        platforms: [{ chatId: selectedOption.chatId, platform: selectedOption.platform, accountId: selectedOption.accountId, addedAt: '' }],
      };
    }
  }, [selectedOption]);

  if (!sourceContact) return null;

  const sourceInitials = sourceContact.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasResults = availableCrmContacts.length > 0 || availableBeeperContacts.length > 0;
  const isSearching = searchQuery.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Another Platform
          </DialogTitle>
          <DialogDescription>
            Search for {sourceContact.displayName} on another platform to link their accounts together.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Source contact preview */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-2">Current contact:</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={getAvatarSrc(sourceContact.avatarUrl)} alt={sourceContact.displayName} />
                <AvatarFallback>{sourceInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{sourceContact.displayName}</p>
                <div className="flex items-center gap-1 mt-1">
                  {sourceContact.platformLinks.map((link) => {
                    const platformInfo = getPlatformInfo(link.platform);
                    return (
                      <Badge
                        key={link.chatId}
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: `${platformInfo.color}20`,
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

          {/* Arrow and selected target */}
          {selectedDisplay && (
            <>
              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-xs text-muted-foreground mb-2">Will be linked:</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getAvatarSrc(selectedDisplay.avatarUrl)} alt={selectedDisplay.name} />
                    <AvatarFallback>
                      {selectedDisplay.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{selectedDisplay.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {selectedDisplay.platforms.map((link) => {
                        const platformInfo = getPlatformInfo(link.platform);
                        return (
                          <Badge
                            key={link.chatId}
                            variant="secondary"
                            className="text-xs"
                            style={{
                              backgroundColor: `${platformInfo.color}20`,
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
            </>
          )}

          {/* CRM Suggestions (when not searching) */}
          {suggestedCrmContacts.length > 0 && !searchQuery && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Suggested matches from your contacts:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedCrmContacts.map((contact) => {
                  const isSelected = selectedOption?.type === 'crm' && selectedOption.contact.id === contact.id;
                  return (
                    <Button
                      key={contact.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-auto py-1.5"
                      onClick={() => setSelectedOption({ type: 'crm', contact })}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={getAvatarSrc(contact.avatarUrl)} />
                        <AvatarFallback className="text-xs">
                          {contact.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {contact.displayName}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all your chats..."
              className="pl-9 h-8 text-sm"
            />
          </div>

          {/* Results list */}
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-4">
              {isLoadingBeeper ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !isSearching && !hasResults && suggestedCrmContacts.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <p>Type a name to search your chats across all platforms</p>
                </div>
              ) : isSearching && !hasResults ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  <p>No matching contacts found</p>
                </div>
              ) : (
                <>
                  {/* CRM contacts section */}
                  {availableCrmContacts.length > 0 && (
                    <div className="space-y-2">
                      {isSearching && availableBeeperContacts.length > 0 && (
                        <p className="text-xs font-medium text-muted-foreground">Your saved contacts:</p>
                      )}
                      {availableCrmContacts.map((contact) => {
                        const initials = contact.displayName
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        const isSelected = selectedOption?.type === 'crm' && selectedOption.contact.id === contact.id;

                        return (
                          <button
                            key={contact.id}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? 'bg-primary/10 border-primary/30'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedOption({ type: 'crm', contact })}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{contact.displayName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {contact.platformLinks.map((link) => {
                                  const platformInfo = getPlatformInfo(link.platform);
                                  return (
                                    <Badge
                                      key={link.chatId}
                                      variant="secondary"
                                      className="text-xs"
                                      style={{
                                        backgroundColor: `${platformInfo.color}20`,
                                        color: platformInfo.color,
                                      }}
                                    >
                                      {platformInfo.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Beeper contacts section (only when searching) */}
                  {availableBeeperContacts.length > 0 && (
                    <div className="space-y-2">
                      {availableCrmContacts.length > 0 && (
                        <p className="text-xs font-medium text-muted-foreground mt-3">Other chats:</p>
                      )}
                      {availableBeeperContacts.map((contact) => {
                        const initials = contact.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        const platformInfo = getPlatformInfo(contact.platform);
                        const isSelected = selectedOption?.type === 'beeper' && selectedOption.chatId === contact.chatId;

                        return (
                          <button
                            key={contact.chatId}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? 'bg-primary/10 border-primary/30'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedOption({
                              type: 'beeper',
                              chatId: contact.chatId,
                              name: contact.name,
                              platform: contact.platform,
                              accountId: contact.accountId,
                              avatarUrl: contact.avatarUrl,
                            })}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.name} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{contact.name}</p>
                              <Badge
                                variant="secondary"
                                className="text-xs mt-0.5"
                                style={{
                                  backgroundColor: `${platformInfo.color}20`,
                                  color: platformInfo.color,
                                }}
                              >
                                {platformInfo.name}
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAction} disabled={!selectedOption}>
            <Link2 className="h-4 w-4 mr-2" />
            {selectedOption?.type === 'crm' ? 'Merge Contacts' : 'Link Platform'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
