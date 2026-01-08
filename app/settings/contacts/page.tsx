'use client';

import { useState, useMemo } from 'react';
import { Search, Users, Tag, Trash2, Link2, Plus, X } from 'lucide-react';
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
import { useCrm } from '@/hooks/use-crm';
import { CrmContactProfile, CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { toast } from 'sonner';

export default function ContactsSettingsPage() {
  const {
    contacts,
    tags,
    deleteContact,
    createTag,
    deleteTag,
    search,
  } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Filter contacts based on search and tag filter
  const filteredContacts = useMemo(() => {
    let result = Object.values(contacts);

    if (searchQuery) {
      result = search(searchQuery);
    }

    if (selectedTagFilter) {
      result = result.filter(c => c.tags.includes(selectedTagFilter));
    }

    // Sort by last updated
    return result.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [contacts, searchQuery, selectedTagFilter, search]);

  const handleDeleteContact = (contact: CrmContactProfile) => {
    deleteContact(contact.id);
    toast.success(`Deleted ${contact.displayName}`);
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
              </CardDescription>
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

                return (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
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

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
