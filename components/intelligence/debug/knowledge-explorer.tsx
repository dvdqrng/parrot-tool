'use client';

/**
 * Knowledge Explorer
 * Browse and search facts per contact for debugging
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ContactIntelligence,
  ExtractedFact,
  FactCategory,
} from '@/lib/intelligence/knowledge/types';
import { contactStore } from '@/lib/intelligence/knowledge/store';
import { deduplicateFactsArray } from '@/lib/intelligence/knowledge/deduplication';
import {
  Search,
  RefreshCw,
  User,
  Calendar,
  MapPin,
  Briefcase,
  Heart,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  Phone,
  Target,
  Lightbulb,
  Trash2,
  Pencil,
  Pin,
  Plus,
  Check,
  X,
} from 'lucide-react';

const CATEGORY_ICONS: Record<FactCategory, React.ReactNode> = {
  personal: <User className="w-3 h-3" />,
  professional: <Briefcase className="w-3 h-3" />,
  preference: <Star className="w-3 h-3" />,
  event: <Calendar className="w-3 h-3" />,
  relationship: <Heart className="w-3 h-3" />,
  location: <MapPin className="w-3 h-3" />,
  occupation: <Briefcase className="w-3 h-3" />,
  plan: <Target className="w-3 h-3" />,
  contact_info: <Phone className="w-3 h-3" />,
  interest: <Lightbulb className="w-3 h-3" />,
  other: <AlertCircle className="w-3 h-3" />,
};

export function KnowledgeExplorer() {
  const [contacts, setContacts] = useState<ContactIntelligence[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactIntelligence | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FactCategory | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allContacts = await contactStore.getAll();
      // Sort by fact count
      allContacts.sort((a, b) => (b.facts?.length || 0) - (a.facts?.length || 0));
      setContacts(allContacts);
      if (allContacts.length > 0 && !selectedContact) {
        setSelectedContact(allContacts[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [selectedContact]);

  // Deduplicate all contacts' facts
  const deduplicateAll = useCallback(async () => {
    setIsLoading(true);
    try {
      let totalRemoved = 0;
      for (const contact of contacts) {
        if (!contact.facts || contact.facts.length <= 1) continue;

        const uniqueFacts = deduplicateFactsArray(contact.facts);
        const removed = contact.facts.length - uniqueFacts.length;

        if (removed > 0) {
          totalRemoved += removed;
          await contactStore.upsert({
            ...contact,
            facts: uniqueFacts,
          });
        }
      }

      if (totalRemoved > 0) {
        console.log(`Removed ${totalRemoved} duplicate facts`);
        await loadContacts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deduplicate');
    } finally {
      setIsLoading(false);
    }
  }, [contacts, loadContacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filter facts based on search and category
  const filteredFacts = selectedContact?.facts?.filter((fact) => {
    const matchesSearch =
      searchQuery === '' ||
      fact.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || fact.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate stats
  const totalFacts = contacts.reduce((sum, c) => sum + (c.facts?.length || 0), 0);
  const activeFacts = contacts.reduce(
    (sum, c) => sum + (c.facts?.filter((f) => f.isActive).length || 0),
    0
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Knowledge Explorer</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {contacts.length} contacts
          </Badge>
          <Badge variant="outline">
            {activeFacts}/{totalFacts} facts active
          </Badge>
          <Button variant="outline" size="sm" onClick={deduplicateAll}>
            Deduplicate
          </Button>
          <Button variant="outline" size="sm" onClick={loadContacts}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Contact List */}
        <Card className="col-span-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="font-medium text-sm truncate">
                      {contact.displayName || contact.id || 'Unknown'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {contact.facts?.length || 0} facts
                      </Badge>
                      {contact.relationship?.type && (
                        <Badge variant="secondary" className="text-xs">
                          {contact.relationship.type.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
                {contacts.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No contacts found
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Fact Details */}
        <Card className="col-span-2">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {selectedContact
                  ? `Facts for ${selectedContact.displayName || selectedContact.id}`
                  : 'Select a contact'}
              </CardTitle>
              {selectedContact && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search facts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-48"
                    />
                  </div>
                  <Select
                    value={categoryFilter}
                    onValueChange={(v) => setCategoryFilter(v as FactCategory | 'all')}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="preference">Preference</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="relationship">Relationship</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {selectedContact ? (
                <div className="divide-y">
                  {filteredFacts?.map((fact) => (
                    <FactCard
                      key={fact.id}
                      fact={fact}
                      onDelete={async () => {
                        if (!selectedContact) return;
                        console.log('[KnowledgeExplorer] DELETE fact:', {
                          factId: fact.id,
                          content: fact.content.slice(0, 50),
                          category: fact.category,
                          contact: selectedContact.displayName,
                        });
                        const updatedFacts = selectedContact.facts.map(f =>
                          f.id === fact.id ? { ...f, isActive: false } : f
                        );
                        await contactStore.upsert({ ...selectedContact, facts: updatedFacts });
                        setSelectedContact({ ...selectedContact, facts: updatedFacts });
                        console.log('[KnowledgeExplorer] Fact deactivated successfully');
                      }}
                      onEdit={async (newContent) => {
                        if (!selectedContact) return;
                        console.log('[KnowledgeExplorer] EDIT fact:', {
                          factId: fact.id,
                          oldContent: fact.content.slice(0, 50),
                          newContent: newContent.slice(0, 50),
                          category: fact.category,
                          contact: selectedContact.displayName,
                        });
                        const updatedFacts = selectedContact.facts.map(f =>
                          f.id === fact.id ? { ...f, content: newContent, userEdited: true } : f
                        );
                        await contactStore.upsert({ ...selectedContact, facts: updatedFacts });
                        setSelectedContact({ ...selectedContact, facts: updatedFacts });
                        console.log('[KnowledgeExplorer] Fact edited successfully (userEdited=true)');
                      }}
                      onToggleVerified={async () => {
                        if (!selectedContact) return;
                        const newVerified = !fact.userVerified;
                        console.log('[KnowledgeExplorer] TOGGLE PIN fact:', {
                          factId: fact.id,
                          content: fact.content.slice(0, 50),
                          wasVerified: fact.userVerified,
                          nowVerified: newVerified,
                          contact: selectedContact.displayName,
                        });
                        const updatedFacts = selectedContact.facts.map(f =>
                          f.id === fact.id ? { ...f, userVerified: newVerified } : f
                        );
                        await contactStore.upsert({ ...selectedContact, facts: updatedFacts });
                        setSelectedContact({ ...selectedContact, facts: updatedFacts });
                        console.log(`[KnowledgeExplorer] Fact ${newVerified ? 'pinned (protected from AI overwrite)' : 'unpinned'}`);
                      }}
                    />
                  ))}
                  {(!filteredFacts || filteredFacts.length === 0) && (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {searchQuery || categoryFilter !== 'all'
                        ? 'No matching facts'
                        : 'No facts extracted yet'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Select a contact to view their facts
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// FACT CARD
// ============================================

function FactCard({
  fact,
  onDelete,
  onEdit,
  onToggleVerified,
}: {
  fact: ExtractedFact;
  onDelete?: () => void;
  onEdit?: (newContent: string) => void;
  onToggleVerified?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(fact.content);

  return (
    <div className={`p-3 ${!fact.isActive ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{CATEGORY_ICONS[fact.category]}</div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="text-xs h-7"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onEdit?.(editContent);
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setEditContent(fact.content);
                    setIsEditing(false);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => { onEdit?.(editContent); setIsEditing(false); }}
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => { setEditContent(fact.content); setIsEditing(false); }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="text-sm flex items-center gap-1">
              {fact.content}
              {fact.userVerified && (
                <Pin className="w-3 h-3 text-blue-500 inline-block flex-shrink-0" />
              )}
              {fact.userEdited && (
                <Pencil className="w-2.5 h-2.5 text-muted-foreground inline-block flex-shrink-0" />
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {fact.category}
            </Badge>
            <span>
              Confidence: {(fact.confidence * 100).toFixed(0)}%
            </span>
            <span>
              Extracted: {fact.extractedAt ? new Date(fact.extractedAt).toLocaleDateString() : fact.source?.extractedAt ? new Date(fact.source.extractedAt).toLocaleDateString() : 'Unknown'}
            </span>
            {fact.isActive ? (
              <CheckCircle className="w-3 h-3 text-green-500" />
            ) : (
              <XCircle className="w-3 h-3 text-red-500" />
            )}

            {/* Action buttons */}
            {fact.isActive && (
              <div className="ml-auto flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  title={fact.userVerified ? 'Unpin fact' : 'Pin fact (protects from AI overwrite)'}
                  onClick={onToggleVerified}
                >
                  <Pin className={`w-3 h-3 ${fact.userVerified ? 'text-blue-500' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  title="Edit fact"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  title="Delete fact"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            )}
          </div>
          {fact.sourceContext && (
            <div className="mt-1 text-xs text-muted-foreground italic truncate">
              Source: &quot;{fact.sourceContext}&quot;
            </div>
          )}
          {fact.supersededBy && (
            <div className="mt-1 text-xs text-orange-500">
              Superseded by another fact
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
