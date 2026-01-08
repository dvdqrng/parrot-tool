'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, Users, Tag, Trash2, Link2, Plus, X, MessageSquare, ArrowUpRight, ArrowDownLeft, Calendar, ChevronRight, Filter, Clock, Zap, AlertCircle, CheckSquare, Square, Layers, Activity, Timer, TrendingUp, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useCrm } from '@/hooks/use-crm';
import { CrmContactProfile, CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { toast } from 'sonner';

// Smart segment types
type SmartSegment = 'all' | 'frequent' | 'recent' | 'inactive' | 'high-importance' | string; // string for platform filters

export default function ContactsSettingsPage() {
  const {
    contacts,
    tags,
    deleteContact,
    updateContact,
    createTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,
    search,
  } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContactProfile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Smart segments and bulk selection
  const [smartSegment, setSmartSegment] = useState<SmartSegment>('all');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Form state for editing contact
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRelationship, setEditRelationship] = useState<string>('');
  const [editImportance, setEditImportance] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');

  // Get unique platforms from all contacts
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    Object.values(contacts).forEach(contact => {
      contact.platformLinks.forEach(link => platforms.add(link.platform));
    });
    return Array.from(platforms);
  }, [contacts]);

  // Filter contacts based on search, tag filter, and smart segment
  const filteredContacts = useMemo(() => {
    let result = Object.values(contacts);

    // Apply search
    if (searchQuery) {
      result = search(searchQuery);
    }

    // Apply tag filter
    if (selectedTagFilter) {
      result = result.filter(c => c.tags.includes(selectedTagFilter));
    }

    // Apply smart segment filter
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (smartSegment) {
      case 'frequent':
        // Contacts with more than 50 messages
        result = result.filter(c => (c.totalMessageCount || 0) >= 50);
        break;
      case 'recent':
        // Contacted in last 7 days
        result = result.filter(c => {
          if (!c.lastInteractionAt) return false;
          return new Date(c.lastInteractionAt) >= sevenDaysAgo;
        });
        break;
      case 'inactive':
        // Not contacted in 30+ days
        result = result.filter(c => {
          if (!c.lastInteractionAt) return true; // Never interacted = inactive
          return new Date(c.lastInteractionAt) < thirtyDaysAgo;
        });
        break;
      case 'high-importance':
        result = result.filter(c => c.importance === 'high');
        break;
      case 'all':
        // No additional filtering
        break;
      default:
        // Platform filter (smartSegment is the platform name)
        if (smartSegment.startsWith('platform:')) {
          const platform = smartSegment.replace('platform:', '');
          result = result.filter(c =>
            c.platformLinks.some(link => link.platform === platform)
          );
        }
        break;
    }

    // Sort by last interaction (most recent first), then by updated date
    return result.sort((a, b) => {
      const aTime = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
      const bTime = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [contacts, searchQuery, selectedTagFilter, smartSegment, search]);

  // Smart segment counts for display
  const segmentCounts = useMemo(() => {
    const all = Object.values(contacts);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      all: all.length,
      frequent: all.filter(c => (c.totalMessageCount || 0) >= 50).length,
      recent: all.filter(c => c.lastInteractionAt && new Date(c.lastInteractionAt) >= sevenDaysAgo).length,
      inactive: all.filter(c => !c.lastInteractionAt || new Date(c.lastInteractionAt) < thirtyDaysAgo).length,
      highImportance: all.filter(c => c.importance === 'high').length,
    };
  }, [contacts]);

  // Selection helpers
  const toggleContactSelection = useCallback((contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
  }, [filteredContacts]);

  const clearSelection = useCallback(() => {
    setSelectedContactIds(new Set());
    setIsSelectionMode(false);
  }, []);

  // Bulk actions
  const bulkAddTag = useCallback((tagId: string) => {
    selectedContactIds.forEach(contactId => {
      addTagToContact(contactId, tagId);
    });
    toast.success(`Added tag to ${selectedContactIds.size} contacts`);
  }, [selectedContactIds, addTagToContact]);

  const bulkRemoveTag = useCallback((tagId: string) => {
    selectedContactIds.forEach(contactId => {
      removeTagFromContact(contactId, tagId);
    });
    toast.success(`Removed tag from ${selectedContactIds.size} contacts`);
  }, [selectedContactIds, removeTagFromContact]);

  const bulkDelete = useCallback(() => {
    selectedContactIds.forEach(contactId => {
      deleteContact(contactId);
    });
    toast.success(`Deleted ${selectedContactIds.size} contacts`);
    clearSelection();
  }, [selectedContactIds, deleteContact, clearSelection]);

  const handleOpenDetail = (contact: CrmContactProfile) => {
    setSelectedContact(contact);
    setEditDisplayName(contact.displayName);
    setEditNickname(contact.nickname || '');
    setEditEmail(contact.email || '');
    setEditPhone(contact.phone || '');
    setEditCompany(contact.company || '');
    setEditRole(contact.role || '');
    setEditLocation(contact.location || '');
    setEditRelationship(contact.relationship || '');
    setEditImportance(contact.importance || '');
    setEditNotes(contact.notes || '');
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedContact(null);
  };

  const handleSaveContact = () => {
    if (!selectedContact) return;
    updateContact(selectedContact.id, {
      displayName: editDisplayName,
      nickname: editNickname || undefined,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      company: editCompany || undefined,
      role: editRole || undefined,
      location: editLocation || undefined,
      relationship: editRelationship as CrmContactProfile['relationship'] || undefined,
      importance: editImportance as CrmContactProfile['importance'] || undefined,
      notes: editNotes || '',
    });
    toast.success('Contact updated');
    handleCloseDetail();
  };

  const handleDeleteContact = (contact: CrmContactProfile) => {
    deleteContact(contact.id);
    toast.success(`Deleted ${contact.displayName}`);
    if (selectedContact?.id === contact.id) {
      handleCloseDetail();
    }
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTag(newTagName.trim());
    setNewTagName('');
    toast.success('Tag created');
  };

  const handleDeleteTag = (tag: CrmTag) => {
    deleteTag(tag.id);
    if (selectedTagFilter === tag.id) {
      setSelectedTagFilter(null);
    }
    toast.success(`Deleted tag "${tag.name}"`);
  };

  const getAvatarSrc = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('file://')) {
      return `/api/avatar?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const tagList = Object.values(tags);
  const contactList = filteredContacts;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-medium">Contacts</h2>
        <p className="text-xs text-muted-foreground">
          Manage your CRM contact profiles and tags
        </p>
      </div>

      {/* Tags Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" strokeWidth={2} />
            Tags
          </CardTitle>
          <CardDescription>
            Organize contacts with custom tags
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new tag */}
          <div className="flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateTag();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {/* Tag list */}
          {tagList.length === 0 ? (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">No tags yet</p>
              <p className="text-xs text-muted-foreground">
                Create tags to organize your contacts
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagList.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:opacity-80 pr-1"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  onClick={() => setSelectedTagFilter(
                    selectedTagFilter === tag.id ? null : tag.id
                  )}
                >
                  {tag.name}
                  {selectedTagFilter === tag.id && (
                    <span className="ml-1">(filtered)</span>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="ml-1 p-0.5 hover:bg-black/10 rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the tag "{tag.name}"?
                          This will remove it from all contacts.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTag(tag)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Segments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" strokeWidth={2} />
            Smart Segments
          </CardTitle>
          <CardDescription>
            Auto-organized contact groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={smartSegment === 'all' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSmartSegment('all')}
            >
              <Users className="h-3 w-3 mr-1" />
              All ({segmentCounts.all})
            </Badge>
            <Badge
              variant={smartSegment === 'recent' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSmartSegment('recent')}
            >
              <Clock className="h-3 w-3 mr-1" />
              Recent ({segmentCounts.recent})
            </Badge>
            <Badge
              variant={smartSegment === 'frequent' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSmartSegment('frequent')}
            >
              <Zap className="h-3 w-3 mr-1" />
              Frequent ({segmentCounts.frequent})
            </Badge>
            <Badge
              variant={smartSegment === 'inactive' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSmartSegment('inactive')}
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Inactive ({segmentCounts.inactive})
            </Badge>
            <Badge
              variant={smartSegment === 'high-importance' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSmartSegment('high-importance')}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              High Priority ({segmentCounts.highImportance})
            </Badge>

            {/* Platform segments */}
            {availablePlatforms.map(platform => {
              const platformInfo = getPlatformInfo(platform);
              const isSelected = smartSegment === `platform:${platform}`;
              return (
                <Badge
                  key={platform}
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  style={isSelected ? {} : {
                    borderColor: platformInfo.color,
                    color: platformInfo.color,
                  }}
                  onClick={() => setSmartSegment(isSelected ? 'all' : `platform:${platform}`)}
                >
                  <Layers className="h-3 w-3 mr-1" />
                  {platformInfo.name}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" strokeWidth={2} />
            Activity Feed
          </CardTitle>
          <CardDescription>
            Recent interactions across all platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            // Get contacts with recent activity
            const recentContacts = Object.values(contacts)
              .filter(c => c.lastInteractionAt)
              .sort((a, b) => {
                const aTime = new Date(a.lastInteractionAt!).getTime();
                const bTime = new Date(b.lastInteractionAt!).getTime();
                return bTime - aTime;
              })
              .slice(0, 10);

            if (recentContacts.length === 0) {
              return (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-xs text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground">
                    Activity will appear here as you interact with contacts
                  </p>
                </div>
              );
            }

            const formatRelativeTime = (dateStr: string) => {
              const date = new Date(dateStr);
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffMins = Math.floor(diffMs / (1000 * 60));
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

              if (diffMins < 60) return `${diffMins}m ago`;
              if (diffHours < 24) return `${diffHours}h ago`;
              if (diffDays < 7) return `${diffDays}d ago`;
              return date.toLocaleDateString();
            };

            return (
              <div className="space-y-2">
                {recentContacts.map((contact) => {
                  const initials = contact.displayName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  const primaryPlatform = contact.platformLinks[0];
                  const platformInfo = primaryPlatform ? getPlatformInfo(primaryPlatform.platform) : null;

                  // Determine activity type icon and text
                  const lastInbound = contact.lastInboundAt ? new Date(contact.lastInboundAt).getTime() : 0;
                  const lastOutbound = contact.lastOutboundAt ? new Date(contact.lastOutboundAt).getTime() : 0;
                  const isLastFromMe = lastOutbound > lastInbound;

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(contact)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} className="object-cover" />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{contact.displayName}</p>
                          {platformInfo && (
                            <Badge
                              variant="secondary"
                              className="text-xs h-4 px-1"
                              style={{
                                backgroundColor: `${platformInfo.color}20`,
                                color: platformInfo.color,
                              }}
                            >
                              {platformInfo.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {isLastFromMe ? (
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3 text-blue-500" />
                              You sent a message
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ArrowDownLeft className="h-3 w-3 text-green-500" />
                              {contact.displayName.split(' ')[0]} sent a message
                            </span>
                          )}
                          {contact.lastConversationInitiator && (
                            <span className="text-muted-foreground/50">
                              • {contact.lastConversationInitiator === 'me' ? 'You started' : 'They started'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground shrink-0">
                        {contact.lastInteractionAt && formatRelativeTime(contact.lastInteractionAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Relationship Health Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" strokeWidth={2} />
            Relationship Health
          </CardTitle>
          <CardDescription>
            Contacts that may need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            // Contacts needing attention
            const needsAttention = Object.values(contacts)
              .filter(c => {
                // High importance but inactive for 14+ days
                if (c.importance === 'high' && c.lastInteractionAt) {
                  const lastDate = new Date(c.lastInteractionAt);
                  return lastDate < fourteenDaysAgo;
                }
                // Any contact inactive for 30+ days
                if (c.lastInteractionAt) {
                  const lastDate = new Date(c.lastInteractionAt);
                  return lastDate < thirtyDaysAgo;
                }
                return false;
              })
              .sort((a, b) => {
                // Sort by importance first, then by last interaction
                if (a.importance === 'high' && b.importance !== 'high') return -1;
                if (b.importance === 'high' && a.importance !== 'high') return 1;
                const aTime = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
                const bTime = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
                return aTime - bTime;
              })
              .slice(0, 5);

            // Contacts waiting for my reply
            const waitingForReply = Object.values(contacts)
              .filter(c => {
                if (!c.lastInboundAt || !c.lastOutboundAt) return false;
                const lastIn = new Date(c.lastInboundAt).getTime();
                const lastOut = new Date(c.lastOutboundAt).getTime();
                return lastIn > lastOut; // They messaged more recently than I did
              })
              .sort((a, b) => {
                const aTime = new Date(a.lastInboundAt!).getTime();
                const bTime = new Date(b.lastInboundAt!).getTime();
                return aTime - bTime; // Oldest waiting first
              })
              .slice(0, 5);

            if (needsAttention.length === 0 && waitingForReply.length === 0) {
              return (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    All relationships are healthy
                  </p>
                </div>
              );
            }

            const formatDaysAgo = (dateStr: string) => {
              const date = new Date(dateStr);
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
              return `${diffDays} days ago`;
            };

            return (
              <div className="space-y-4">
                {/* Waiting for my reply */}
                {waitingForReply.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Waiting for your reply
                    </h4>
                    {waitingForReply.map((contact) => {
                      const initials = contact.displayName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2 cursor-pointer hover:bg-yellow-500/10 transition-colors"
                          onClick={() => handleOpenDetail(contact)}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} className="object-cover" />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contact.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              Messaged you {contact.lastInboundAt && formatDaysAgo(contact.lastInboundAt)}
                            </p>
                          </div>
                          {contact.importance === 'high' && (
                            <Badge variant="destructive" className="text-xs h-4 px-1">
                              High Priority
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inactive contacts */}
                {needsAttention.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <UserX className="h-3 w-3" />
                      Haven't talked in a while
                    </h4>
                    {needsAttention.map((contact) => {
                      const initials = contact.displayName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-2 cursor-pointer hover:bg-orange-500/10 transition-colors"
                          onClick={() => handleOpenDetail(contact)}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} className="object-cover" />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contact.displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              Last contact: {contact.lastInteractionAt && formatDaysAgo(contact.lastInteractionAt)}
                            </p>
                          </div>
                          {contact.importance === 'high' && (
                            <Badge variant="destructive" className="text-xs h-4 px-1">
                              High Priority
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Response Metrics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4" strokeWidth={2} />
            Response Metrics
          </CardTitle>
          <CardDescription>
            Your communication patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const contactsWithMetrics = Object.values(contacts).filter(
              c => c.avgResponseTimeMinutes !== undefined || c.messageFrequencyPerDay !== undefined
            );

            if (contactsWithMetrics.length === 0) {
              return (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-xs text-muted-foreground">No metrics available yet</p>
                  <p className="text-xs text-muted-foreground">
                    Metrics will be calculated as you chat with contacts
                  </p>
                </div>
              );
            }

            // Calculate aggregate metrics
            const avgResponseTimes = contactsWithMetrics
              .filter(c => c.avgResponseTimeMinutes !== undefined)
              .map(c => c.avgResponseTimeMinutes!);

            const overallAvgResponse = avgResponseTimes.length > 0
              ? Math.round(avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length)
              : null;

            const frequencies = contactsWithMetrics
              .filter(c => c.messageFrequencyPerDay !== undefined)
              .map(c => c.messageFrequencyPerDay!);

            const overallFrequency = frequencies.length > 0
              ? Math.round(frequencies.reduce((a, b) => a + b, 0) * 10) / 10
              : null;

            // Top contacts by message count
            const topByMessages = [...contactsWithMetrics]
              .filter(c => c.totalMessageCount && c.totalMessageCount > 0)
              .sort((a, b) => (b.totalMessageCount || 0) - (a.totalMessageCount || 0))
              .slice(0, 5);

            // Fastest response times
            const fastestResponders = [...contactsWithMetrics]
              .filter(c => c.avgResponseTimeMinutes !== undefined)
              .sort((a, b) => (a.avgResponseTimeMinutes || 0) - (b.avgResponseTimeMinutes || 0))
              .slice(0, 5);

            const formatResponseTime = (minutes: number) => {
              if (minutes < 60) return `${minutes}m`;
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
              const days = Math.floor(hours / 24);
              return `${days}d`;
            };

            return (
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-3">
                  {overallAvgResponse !== null && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="text-lg font-semibold">{formatResponseTime(overallAvgResponse)}</div>
                      <div className="text-xs text-muted-foreground">Avg response time</div>
                    </div>
                  )}
                  {overallFrequency !== null && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="text-lg font-semibold">{overallFrequency}</div>
                      <div className="text-xs text-muted-foreground">Messages/day (avg)</div>
                    </div>
                  )}
                </div>

                {/* Top contacts by messages */}
                {topByMessages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Most Active Conversations
                    </h4>
                    <div className="space-y-1">
                      {topByMessages.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleOpenDetail(contact)}
                        >
                          <span className="text-sm truncate">{contact.displayName}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{contact.totalMessageCount} msgs</span>
                            {contact.messageFrequencyPerDay !== undefined && (
                              <span className="text-muted-foreground/50">
                                {contact.messageFrequencyPerDay}/day
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fastest response times */}
                {fastestResponders.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Fastest Response Times
                    </h4>
                    <div className="space-y-1">
                      {fastestResponders.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleOpenDetail(contact)}
                        >
                          <span className="text-sm truncate">{contact.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatResponseTime(contact.avgResponseTimeMinutes!)} avg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Contacts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" strokeWidth={2} />
                Contact Profiles
              </CardTitle>
              <CardDescription>
                {contactList.length} contact{contactList.length !== 1 ? 's' : ''}
                {selectedTagFilter && ` with selected tag`}
                {smartSegment !== 'all' && ` in segment`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Selection mode toggle */}
              <Button
                variant={isSelectionMode ? 'secondary' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => {
                  if (isSelectionMode) {
                    clearSelection();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
              >
                {isSelectionMode ? (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select
                  </>
                )}
              </Button>

              {/* Bulk actions dropdown */}
              {isSelectionMode && selectedContactIds.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      Actions ({selectedContactIds.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={selectAllVisible}>
                      Select all visible ({filteredContacts.length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Tag className="h-3 w-3 mr-2" />
                        Add tag
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {Object.values(tags).map(tag => (
                          <DropdownMenuItem
                            key={tag.id}
                            onClick={() => bulkAddTag(tag.id)}
                          >
                            <div
                              className="w-2 h-2 rounded-full mr-2"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </DropdownMenuItem>
                        ))}
                        {Object.keys(tags).length === 0 && (
                          <DropdownMenuItem disabled>No tags</DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <X className="h-3 w-3 mr-2" />
                        Remove tag
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {Object.values(tags).map(tag => (
                          <DropdownMenuItem
                            key={tag.id}
                            onClick={() => bulkRemoveTag(tag.id)}
                          >
                            <div
                              className="w-2 h-2 rounded-full mr-2"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </DropdownMenuItem>
                        ))}
                        {Object.keys(tags).length === 0 && (
                          <DropdownMenuItem disabled>No tags</DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete selected
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Contacts</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedContactIds.size} contacts?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={bulkDelete}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="pl-9 h-8 text-sm"
            />
          </div>

          {selectedTagFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtered by:</span>
              <Badge
                variant="secondary"
                className="text-xs cursor-pointer"
                style={{
                  backgroundColor: `${tags[selectedTagFilter]?.color}20`,
                  color: tags[selectedTagFilter]?.color,
                }}
                onClick={() => setSelectedTagFilter(null)}
              >
                {tags[selectedTagFilter]?.name}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            </div>
          )}

          <Separator />

          {/* Contact list */}
          {contactList.length === 0 ? (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">No contacts found</p>
              <p className="text-xs text-muted-foreground">
                {searchQuery || selectedTagFilter
                  ? 'Try adjusting your search or filter'
                  : 'Contact profiles are created when you view a chat and open the contact panel'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contactList.map((contact) => {
                const initials = contact.displayName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isSelected = selectedContactIds.has(contact.id);

                return (
                  <div
                    key={contact.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isSelected ? 'bg-muted/50 border-primary' : ''
                    }`}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleContactSelection(contact.id);
                      } else {
                        handleOpenDetail(contact);
                      }
                    }}
                  >
                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                    )}

                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} className="object-cover" />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{contact.displayName}</p>
                        {contact.nickname && (
                          <span className="text-xs text-muted-foreground">"{contact.nickname}"</span>
                        )}
                      </div>

                      {/* Contact info */}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {contact.company && <span>{contact.company}</span>}
                        {contact.role && <span>- {contact.role}</span>}
                        {contact.email && <span>- {contact.email}</span>}
                      </div>

                      {/* Platform links */}
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                        <div className="flex flex-wrap gap-1">
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

                      {/* Interaction stats */}
                      {(contact.totalMessageCount || contact.lastInteractionAt) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {contact.totalMessageCount && contact.totalMessageCount > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {contact.totalMessageCount} messages
                            </span>
                          )}
                          {contact.messagesReceived !== undefined && contact.messagesReceived > 0 && (
                            <span className="flex items-center gap-1">
                              <ArrowDownLeft className="h-3 w-3 text-green-500" />
                              {contact.messagesReceived}
                            </span>
                          )}
                          {contact.messagesSent !== undefined && contact.messagesSent > 0 && (
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3 text-blue-500" />
                              {contact.messagesSent}
                            </span>
                          )}
                          {contact.lastInteractionAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(contact.lastInteractionAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      {contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map(tagId => {
                            const tag = tags[tagId];
                            if (!tag) return null;
                            return (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: tag.color, color: tag.color }}
                              >
                                {tag.name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}

                      {/* Notes preview */}
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{contact.displayName}"?
                              This will remove all their profile data, tags, and notes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteContact(contact)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Contact</SheetTitle>
            <SheetDescription>
              Update contact information and settings
            </SheetDescription>
          </SheetHeader>

          {selectedContact && (
            <div className="space-y-6 mt-6">
              {/* Avatar and name header */}
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={getAvatarSrc(selectedContact.avatarUrl)} alt={selectedContact.displayName} className="object-cover" />
                  <AvatarFallback className="text-lg">
                    {selectedContact.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="space-y-1">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="Optional nickname"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="City, Country"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    placeholder="Company name"
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="Job title"
                    className="h-8"
                  />
                </div>
              </div>

              <Separator />

              {/* Relationship settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Relationship</Label>
                  <Select value={editRelationship} onValueChange={setEditRelationship}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="acquaintance">Acquaintance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Importance</Label>
                  <Select value={editImportance} onValueChange={setEditImportance}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Tags section */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(tags).map((tag) => {
                    const isSelected = selectedContact.tags.includes(tag.id);
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        style={{
                          backgroundColor: isSelected ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: isSelected ? 'white' : tag.color,
                        }}
                        onClick={() => {
                          if (isSelected) {
                            removeTagFromContact(selectedContact.id, tag.id);
                          } else {
                            addTagToContact(selectedContact.id, tag.id);
                          }
                        }}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                  {Object.keys(tags).length === 0 && (
                    <p className="text-xs text-muted-foreground">No tags available. Create tags above.</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Interaction stats (read-only) */}
              {(selectedContact.totalMessageCount || selectedContact.lastInteractionAt) && (
                <>
                  <div className="space-y-2">
                    <Label>Activity Statistics</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedContact.totalMessageCount !== undefined && selectedContact.totalMessageCount > 0 && (
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-lg font-semibold">{selectedContact.totalMessageCount}</div>
                          <div className="text-xs text-muted-foreground">Total messages</div>
                        </div>
                      )}
                      {(selectedContact.messagesSent !== undefined || selectedContact.messagesReceived !== undefined) && (
                        <div className="p-2 rounded-lg bg-muted/50 space-y-1">
                          {selectedContact.messagesReceived !== undefined && selectedContact.messagesReceived > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <ArrowDownLeft className="h-3 w-3 text-green-500" />
                              <span>{selectedContact.messagesReceived} received</span>
                            </div>
                          )}
                          {selectedContact.messagesSent !== undefined && selectedContact.messagesSent > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <ArrowUpRight className="h-3 w-3 text-blue-500" />
                              <span>{selectedContact.messagesSent} sent</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Response time and frequency */}
                      {selectedContact.avgResponseTimeMinutes !== undefined && (
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-lg font-semibold">
                            {selectedContact.avgResponseTimeMinutes < 60
                              ? `${selectedContact.avgResponseTimeMinutes}m`
                              : selectedContact.avgResponseTimeMinutes < 1440
                                ? `${Math.floor(selectedContact.avgResponseTimeMinutes / 60)}h`
                                : `${Math.floor(selectedContact.avgResponseTimeMinutes / 1440)}d`}
                          </div>
                          <div className="text-xs text-muted-foreground">Avg response time</div>
                        </div>
                      )}
                      {selectedContact.messageFrequencyPerDay !== undefined && (
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-lg font-semibold">{selectedContact.messageFrequencyPerDay}</div>
                          <div className="text-xs text-muted-foreground">Messages/day</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* Conversation initiator */}
                      {selectedContact.lastConversationInitiator && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {selectedContact.lastConversationInitiator === 'me' ? (
                            <>
                              <ArrowUpRight className="h-3 w-3 text-blue-500" />
                              <span>You started the last conversation</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="h-3 w-3 text-green-500" />
                              <span>They started the last conversation</span>
                            </>
                          )}
                        </div>
                      )}
                      {selectedContact.firstInteractionAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>First message: {new Date(selectedContact.firstInteractionAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      {selectedContact.lastInteractionAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Last message: {new Date(selectedContact.lastInteractionAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Connected platforms (read-only) */}
              <div className="space-y-2">
                <Label>Connected Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.platformLinks.map((link) => {
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
                        {link.displayName && ` (${link.displayName})`}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this contact..."
                  className="min-h-[100px] text-sm"
                />
              </div>

              {/* Save button */}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={handleCloseDetail}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSaveContact}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
