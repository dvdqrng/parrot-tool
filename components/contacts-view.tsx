'use client';

import { useState, useMemo } from 'react';
import { Search, Tag, Trash2, Plus, X, Mail, Building2, MessageSquare, Clock, ArrowUpDown, ArrowUp, ArrowDown, Check, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { CrmContactProfile, CrmTag } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { getAvatarSrc } from '@/components/message-panel/utils';
import { toast } from 'sonner';

interface ContactsViewProps {
  contacts: Record<string, CrmContactProfile>;
  tags: Record<string, CrmTag>;
  deleteContact: (id: string) => void;
  createTag: (name: string, color?: string) => CrmTag;
  deleteTag: (id: string) => void;
  addTagToContact: (contactId: string, tagId: string) => void;
  removeTagFromContact: (contactId: string, tagId: string) => void;
  search: (query: string) => CrmContactProfile[];
  updateContact: (contactId: string, updates: Partial<CrmContactProfile>) => void;
  showHeader?: boolean;
  onContactClick?: (contact: CrmContactProfile) => void;
}

export function ContactsView({
  contacts,
  tags,
  deleteContact,
  createTag,
  deleteTag,
  addTagToContact,
  removeTagFromContact,
  search,
  updateContact,
  showHeader = true,
  onContactClick,
}: ContactsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilters, setSelectedTagFilters] = useState<Set<string>>(new Set());
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<Set<'person' | 'group'>>(new Set());
  const [selectedChannelFilters, setSelectedChannelFilters] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<'name' | 'messages' | 'lastContact'>('lastContact');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [contactToDelete, setContactToDelete] = useState<CrmContactProfile | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    displayName: string;
    email: string;
    phone: string;
    company: string;
    role: string;
  }>({ displayName: '', email: '', phone: '', company: '', role: '' });
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  // Get unique channels
  const availableChannels = useMemo(() => {
    const channels = new Set<string>();
    Object.values(contacts).forEach(contact => {
      contact.platformLinks.forEach(link => channels.add(link.platform));
    });
    return Array.from(channels).sort();
  }, [contacts]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let result = Object.values(contacts);

    // Filter by search query
    if (searchQuery.trim()) {
      result = search(searchQuery);
    }

    // Filter by tags (multi-select - OR logic: show contacts with ANY of the selected tags)
    if (selectedTagFilters.size > 0) {
      result = result.filter(c =>
        c.tags.some(tag => selectedTagFilters.has(tag))
      );
    }

    // Filter by type (multi-select - OR logic: show contacts matching ANY selected type)
    if (selectedTypeFilters.size > 0) {
      result = result.filter(c => {
        if (selectedTypeFilters.has('group') && c.isGroup === true) return true;
        if (selectedTypeFilters.has('person') && c.isGroup === false) return true;
        return false;
      });
    }

    // Filter by channels (multi-select - OR logic: show contacts with ANY of the selected platforms)
    if (selectedChannelFilters.size > 0) {
      result = result.filter(c =>
        c.platformLinks.some(link => selectedChannelFilters.has(link.platform))
      );
    }

    // Sort
    return result.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'messages':
          comparison = (a.totalMessageCount || 0) - (b.totalMessageCount || 0);
          break;
        case 'lastContact':
          const aTime = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
          const bTime = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [contacts, searchQuery, selectedTagFilters, selectedTypeFilters, selectedChannelFilters, sortColumn, sortDirection, search]);

  const handleDeleteContact = (contact: CrmContactProfile) => {
    deleteContact(contact.id);
    toast.success(`Deleted contact "${contact.displayName}"`);
    setContactToDelete(null);
  };

  const handleCreateTag = (name: string, color?: string) => {
    if (!name.trim()) return null;
    const tag = createTag(name.trim(), color);
    toast.success(`Created tag "${tag.name}"`);
    return tag;
  };

  const handleDeleteTag = (tagId: string) => {
    const tag = tags[tagId];
    if (!tag) return;
    deleteTag(tagId);
    toast.success(`Deleted tag "${tag.name}"`);
    if (selectedTagFilters.has(tagId)) {
      setSelectedTagFilters(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    }
  };

  const handleAddTagToContact = (contactId: string, tagId: string) => {
    addTagToContact(contactId, tagId);
  };

  const handleRemoveTagFromContact = (contactId: string, tagId: string) => {
    removeTagFromContact(contactId, tagId);
  };

  const startEditing = (contact: CrmContactProfile) => {
    setEditingContactId(contact.id);
    setEditForm({
      displayName: contact.displayName,
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      role: contact.role || '',
    });
  };

  const saveEdit = (contactId: string) => {
    updateContact(contactId, {
      ...editForm,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      company: editForm.company || undefined,
      role: editForm.role || undefined,
    });
    setEditingContactId(null);
    toast.success('Contact updated');
  };

  const cancelEdit = () => {
    setEditingContactId(null);
  };

  const handleSort = (column: 'name' | 'messages' | 'lastContact') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column - default to descending for messages/lastContact, ascending for name
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleBulkAddTag = (tagId: string) => {
    selectedContacts.forEach(contactId => {
      const contact = contacts[contactId];
      if (contact && !contact.tags.includes(tagId)) {
        addTagToContact(contactId, tagId);
      }
    });
    toast.success(`Added tag to ${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''}`);
    setBulkActionOpen(false);
  };

  const handleBulkDelete = () => {
    const count = selectedContacts.size;
    selectedContacts.forEach(contactId => {
      deleteContact(contactId);
    });
    setSelectedContacts(new Set());
    toast.success(`Deleted ${count} contact${count !== 1 ? 's' : ''}`);
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const toggleTypeFilter = (type: 'person' | 'group') => {
    setSelectedTypeFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const toggleChannelFilter = (channel: string) => {
    setSelectedChannelFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channel)) {
        newSet.delete(channel);
      } else {
        newSet.add(channel);
      }
      return newSet;
    });
  };

  const SortIcon = ({ column }: { column: 'name' | 'messages' | 'lastContact' }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      {showHeader && (
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground mt-2">
            {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-wrap gap-2 items-center shrink-0">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground shrink-0 mr-1">Type:</span>
          <Button
            variant={selectedTypeFilters.has('person') ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => toggleTypeFilter('person')}
          >
            Person
          </Button>
          <Button
            variant={selectedTypeFilters.has('group') ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => toggleTypeFilter('group')}
          >
            Group
          </Button>
        </div>

        {/* Channel filter */}
        {availableChannels.length > 0 && (
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground shrink-0 mr-1">Channel:</span>
            {availableChannels.map(channel => {
              const platformInfo = getPlatformInfo(channel);
              const isSelected = selectedChannelFilters.has(channel);
              return (
                <Button
                  key={channel}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => toggleChannelFilter(channel)}
                  style={
                    isSelected
                      ? { backgroundColor: platformInfo.color, borderColor: platformInfo.color }
                      : {}
                  }
                >
                  {platformInfo.name}
                </Button>
              );
            })}
          </div>
        )}

        {/* Tag filter */}
        {Object.keys(tags).length > 0 && (
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground shrink-0 mr-1">Tag:</span>
            {Object.values(tags).map(tag => {
              const isSelected = selectedTagFilters.has(tag.id);
              return (
                <Button
                  key={tag.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => toggleTagFilter(tag.id)}
                  style={
                    isSelected
                      ? { backgroundColor: tag.color, borderColor: tag.color }
                      : {}
                  }
                >
                  {tag.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedContacts.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border">
          <span className="text-xs font-medium">
            {selectedContacts.size} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedContacts(new Set())}
          >
            Clear
          </Button>
          <Popover open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="h-7 text-xs">
                <Tag className="h-3 w-3 mr-1" />
                Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-3">
                <div className="text-xs font-medium">Add tag to {selectedContacts.size} contacts</div>

                {/* Existing tags */}
                {Object.values(tags).length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Select a tag:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.values(tags).map(tag => (
                        <Button
                          key={tag.id}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleBulkAddTag(tag.id)}
                          style={{
                            backgroundColor: `${tag.color}20`,
                            borderColor: `${tag.color}40`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Create new tag */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Or create new tag:</div>
                  <Input
                    placeholder="Tag name..."
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.currentTarget;
                        const newTag = handleCreateTag(input.value);
                        if (newTag) {
                          handleBulkAddTag(newTag.id);
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-7 text-xs ml-auto">
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedContacts.size} contacts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the selected contacts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Contacts table */}
      <div className="flex-1 min-h-0 rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[200px]">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Name
                  <SortIcon column="name" />
                </button>
              </TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[120px]">Channel</TableHead>
              <TableHead className="w-[200px]">Tags</TableHead>
              <TableHead className="w-[180px]">Email</TableHead>
              <TableHead className="w-[130px]">Phone</TableHead>
              <TableHead className="w-[150px]">Company</TableHead>
              <TableHead className="w-[130px]">Role</TableHead>
              <TableHead className="w-[100px] text-right">
                <button
                  onClick={() => handleSort('messages')}
                  className="flex items-center ml-auto hover:text-foreground transition-colors"
                >
                  Messages
                  <SortIcon column="messages" />
                </button>
              </TableHead>
              <TableHead className="w-[100px] text-right">
                <button
                  onClick={() => handleSort('lastContact')}
                  className="flex items-center ml-auto hover:text-foreground transition-colors"
                >
                  Last Contact
                  <SortIcon column="lastContact" />
                </button>
              </TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                  {searchQuery || selectedTagFilters.size > 0 || selectedTypeFilters.size > 0 || selectedChannelFilters.size > 0 ? 'No contacts found' : 'No contacts yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map(contact => {
                const isEditing = editingContactId === contact.id;
                const initials = contact.displayName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const isSelected = selectedContacts.has(contact.id);

                return (
                  <TableRow key={contact.id} className="group">
                    {/* Checkbox */}
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                        aria-label={`Select ${contact.displayName}`}
                      />
                    </TableCell>

                    {/* Name */}
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={getAvatarSrc(contact.avatarUrl)}
                              alt={contact.displayName}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <Input
                            value={editForm.displayName}
                            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                            className="h-7 text-xs"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(contact)}
                          className="flex items-center gap-2 text-left hover:underline w-full"
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage
                              src={getAvatarSrc(contact.avatarUrl)}
                              alt={contact.displayName}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium">{contact.displayName}</span>
                        </button>
                      )}
                    </TableCell>

                    {/* Type - Person or Group */}
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {contact.isGroup === true ? 'Group' : contact.isGroup === false ? 'Person' : '—'}
                      </span>
                    </TableCell>

                    {/* Channel - Primary platform */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.platformLinks.slice(0, 2).map(link => {
                          const platformInfo = getPlatformInfo(link.platform);
                          return (
                            <Badge
                              key={link.chatId}
                              variant="outline"
                              className="text-xs px-1.5 py-0"
                              style={{
                                backgroundColor: `${platformInfo.color}10`,
                                borderColor: `${platformInfo.color}30`,
                                color: platformInfo.color,
                              }}
                            >
                              {platformInfo.name}
                            </Badge>
                          );
                        })}
                        {contact.platformLinks.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{contact.platformLinks.length - 2}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Tags - inline editing with popover */}
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex flex-wrap gap-1 items-center text-left w-full hover:opacity-80">
                            {contact.tags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Add tags...</span>
                            ) : (
                              contact.tags.map(tagId => {
                                const tag = tags[tagId];
                                if (!tag) return null;
                                return (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0"
                                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                  >
                                    {tag.name}
                                  </Badge>
                                );
                              })
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="start">
                          <div className="space-y-3">
                            <div className="text-xs font-medium">Manage Tags</div>

                            {/* Current tags */}
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.map(tagId => {
                                const tag = tags[tagId];
                                if (!tag) return null;
                                return (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs cursor-pointer hover:opacity-80 pr-1"
                                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                  >
                                    {tag.name}
                                    <button
                                      onClick={() => handleRemoveTagFromContact(contact.id, tag.id)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                              {contact.tags.length === 0 && (
                                <span className="text-xs text-muted-foreground">No tags</span>
                              )}
                            </div>

                            {/* Add existing tag */}
                            {Object.values(tags).filter(t => !contact.tags.includes(t.id)).length > 0 && (
                              <>
                                <div className="text-xs text-muted-foreground">Add existing tag:</div>
                                <Select onValueChange={(tagId) => handleAddTagToContact(contact.id, tagId)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select tag..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.values(tags)
                                      .filter(t => !contact.tags.includes(t.id))
                                      .map(tag => (
                                        <SelectItem key={tag.id} value={tag.id}>
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-2 h-2 rounded-full"
                                              style={{ backgroundColor: tag.color }}
                                            />
                                            {tag.name}
                                          </div>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </>
                            )}

                            {/* Create new tag */}
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Or create new tag:</div>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Tag name..."
                                  className="h-8 text-xs flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const input = e.currentTarget;
                                      const newTag = handleCreateTag(input.value);
                                      if (newTag) {
                                        handleAddTagToContact(contact.id, newTag.id);
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>

                            {/* Manage all tags */}
                            {Object.keys(tags).length > 0 && (
                              <>
                                <div className="border-t pt-3">
                                  <div className="text-xs text-muted-foreground mb-2">All tags:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.values(tags).map(tag => (
                                      <Badge
                                        key={tag.id}
                                        variant="secondary"
                                        className="text-xs cursor-pointer hover:opacity-80 pr-1"
                                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                      >
                                        {tag.name}
                                        <button
                                          onClick={() => handleDeleteTag(tag.id)}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>

                    {/* Email */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="email@example.com"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block">
                          {contact.email || '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Phone */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="+1234567890"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block">
                          {contact.phone || '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Company */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.company}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="Company"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block">
                          {contact.company || '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Role */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="Role"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block">
                          {contact.role || '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Messages */}
                    <TableCell className="text-right">
                      {contact.totalMessageCount !== undefined && contact.totalMessageCount > 0 ? (
                        <span className="text-xs">{contact.totalMessageCount}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Last Contact */}
                    <TableCell className="text-right">
                      {contact.lastInteractionAt ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(contact.lastInteractionAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveEdit(contact.id)}
                            className="h-7 px-2 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-0.5 justify-end">
                          {onContactClick && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onContactClick(contact)}
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                              title="View details"
                            >
                              <UserRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setContactToDelete(contact)}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete contact confirmation */}
      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.displayName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => contactToDelete && handleDeleteContact(contactToDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
