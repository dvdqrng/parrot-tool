'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CrmContactProfile, CrmTag, CrmPlatformLink, ChatKnowledge, ChatFact, ChatFactCategory, ChatFactEntity, ContactAttachment } from '@/lib/types';
import { getPlatformInfo } from '@/lib/beeper-client';
import { getAvatarSrc } from '@/components/message-panel/utils';
import { cn } from '@/lib/utils';
import {
  X,
  Plus,
  Trash2,
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Tag,
  Link2,
  Save,
  MessageSquare,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Brain,
  Eye,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Pencil,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  Download,
} from 'lucide-react';
import { ContactMergeDialog } from '@/components/contact-merge-dialog';

interface ContactProfilePanelProps {
  contact: CrmContactProfile | null;
  allContacts?: Record<string, CrmContactProfile>;
  tags: Record<string, CrmTag>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (contactId: string, updates: Partial<CrmContactProfile>) => void;
  onCreateTag: (name: string) => CrmTag;
  onAddTag: (contactId: string, tagId: string) => void;
  onRemoveTag: (contactId: string, tagId: string) => void;
  onUnlinkPlatform?: (contactId: string, chatId: string) => void;
  onMerge?: (targetContactId: string, sourceContactId: string) => void;
  onLinkPlatform?: (contactId: string, chatId: string, platform: string, accountId: string, displayName: string, avatarUrl?: string) => void;
  knowledge?: ChatKnowledge | null;
  onAddFact?: (content: string, aboutEntity: ChatFactEntity, category: ChatFactCategory) => void;
  onRemoveFact?: (factId: string, aboutEntity: ChatFactEntity) => void;
  onAddAttachments?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContactProfilePanel({
  contact,
  allContacts = {},
  tags,
  isOpen,
  onClose,
  onSave,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  onUnlinkPlatform,
  onMerge,
  onLinkPlatform,
  knowledge,
  onAddFact,
  onRemoveFact,
  onAddAttachments,
  onRemoveAttachment,
}: ContactProfilePanelProps) {
  // Local form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [expandedKnowledgeGroups, setExpandedKnowledgeGroups] = useState<Set<string>>(
    new Set(['contactFacts', 'conversationFacts'])
  );
  const [newFactContent, setNewFactContent] = useState('');
  const [newFactEntity, setNewFactEntity] = useState<ChatFactEntity>('contact');
  const [newFactCategory, setNewFactCategory] = useState<ChatFactCategory>('personal');

  // Sync form state when contact changes
  useEffect(() => {
    if (contact) {
      setDisplayName(contact.displayName);
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setCompany(contact.company || '');
      setRole(contact.role || '');
      setIsDirty(false);
    }
  }, [contact]);

  // Track changes
  const handleFieldChange = useCallback((setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setIsDirty(true);
    };
  }, []);

  const handleSave = useCallback(() => {
    if (!contact) return;

    onSave(contact.id, {
      displayName,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
      role: role || undefined,
    });
    setIsDirty(false);
  }, [contact, displayName, email, phone, company, role, onSave]);

  const handleAddTag = useCallback((tagId: string) => {
    if (!contact) return;
    onAddTag(contact.id, tagId);
  }, [contact, onAddTag]);

  const handleRemoveTag = useCallback((tagId: string) => {
    if (!contact) return;
    onRemoveTag(contact.id, tagId);
  }, [contact, onRemoveTag]);

  const handleCreateTag = useCallback(() => {
    if (!newTagName.trim() || !contact) return;
    const tag = onCreateTag(newTagName.trim());
    onAddTag(contact.id, tag.id);
    setNewTagName('');
  }, [newTagName, contact, onCreateTag, onAddTag]);

  const handleUnlinkPlatform = useCallback((chatId: string) => {
    if (!contact || !onUnlinkPlatform) return;
    onUnlinkPlatform(contact.id, chatId);
  }, [contact, onUnlinkPlatform]);

  if (!isOpen || !contact) return null;

  const initials = contact.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const availableTags = Object.values(tags).filter(
    tag => !contact.tags.includes(tag.id)
  );

  return (
    <div className={cn(
      'h-full transition-all duration-300 ease-in-out',
      isOpen ? 'w-80' : 'w-0'
    )}>
      <div className="h-full bg-card rounded-2xl flex flex-col overflow-hidden shadow-lg dark:border">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={getAvatarSrc(contact.avatarUrl)} alt={contact.displayName} className="object-cover" />
              <AvatarFallback className="text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{contact.displayName}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="h-3 w-3" />
                Basic Info
              </h3>

              <div className="space-y-2">
                <div>
                  <Label htmlFor="displayName" className="text-xs">Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={handleFieldChange(setDisplayName)}
                    placeholder="Display name"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-3 w-3" />
                Contact Details
              </h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={email}
                    onChange={handleFieldChange(setEmail)}
                    placeholder="Email"
                    type="email"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={phone}
                    onChange={handleFieldChange(setPhone)}
                    placeholder="Phone"
                    type="tel"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Work Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                Work
              </h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={company}
                    onChange={handleFieldChange(setCompany)}
                    placeholder="Company"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={role}
                    onChange={handleFieldChange(setRole)}
                    placeholder="Role / Title"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Interaction Stats */}
            {(contact.totalMessageCount || contact.lastInteractionAt) && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    Activity
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Total messages */}
                    {contact.totalMessageCount !== undefined && contact.totalMessageCount > 0 && (
                      <div className="p-2 rounded-lg bg-muted/50">
                        <div className="text-lg font-semibold">{contact.totalMessageCount}</div>
                        <div className="text-xs text-muted-foreground">Total messages</div>
                      </div>
                    )}

                    {/* Messages breakdown */}
                    {(contact.messagesSent !== undefined || contact.messagesReceived !== undefined) && (
                      <div className="p-2 rounded-lg bg-muted/50 space-y-1">
                        {contact.messagesReceived !== undefined && contact.messagesReceived > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <ArrowDownLeft className="h-3 w-3 text-green-500" />
                            <span>{contact.messagesReceived} received</span>
                          </div>
                        )}
                        {contact.messagesSent !== undefined && contact.messagesSent > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <ArrowUpRight className="h-3 w-3 text-blue-500" />
                            <span>{contact.messagesSent} sent</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Response time and last contacted */}
                  <div className="space-y-1">
                    {contact.lastInteractionAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>Last contacted: {new Date(contact.lastInteractionAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {contact.avgResponseTimeMinutes !== undefined && contact.avgResponseTimeMinutes > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Avg response: {contact.avgResponseTimeMinutes < 60 ? `${contact.avgResponseTimeMinutes}m` : `${Math.round(contact.avgResponseTimeMinutes / 60)}h`}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Tags */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Tag className="h-3 w-3" />
                Tags
              </h3>

              {/* Current tags */}
              <div className="flex flex-wrap gap-1">
                {contact.tags.map(tagId => {
                  const tag = tags[tagId];
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      onClick={() => handleRemoveTag(tag.id)}
                    >
                      {tag.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  );
                })}
                {contact.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags</span>
                )}
              </div>

              {/* Add existing tag */}
              {availableTags.length > 0 && (
                <Select onValueChange={handleAddTag}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Add existing tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map(tag => (
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
              )}

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
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Platform Links */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                Connected Platforms
              </h3>

              <div className="space-y-2">
                {contact.platformLinks.map((link: CrmPlatformLink) => {
                  const platformInfo = getPlatformInfo(link.platform);
                  return (
                    <div
                      key={link.chatId}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="secondary"
                          className="shrink-0"
                          style={{
                            backgroundColor: `${platformInfo.color}20`,
                            color: platformInfo.color,
                          }}
                        >
                          {platformInfo.name}
                        </Badge>
                        {link.displayName && (
                          <span className="text-xs text-muted-foreground truncate">
                            {link.displayName}
                          </span>
                        )}
                      </div>
                      {contact.platformLinks.length > 1 && onUnlinkPlatform && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleUnlinkPlatform(link.chatId)}
                          title="Unlink this platform from contact"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Merge button - always show if onMerge is provided */}
              {onMerge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsMergeDialogOpen(true)}
                  title="Link another platform by merging with another contact"
                >
                  <Link2 className="h-3 w-3 mr-2" />
                  Link another platform
                </Button>
              )}
            </div>

            {/* Knowledge */}
            <Separator />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Brain className="h-3 w-3" />
                Memory
              </h3>

              {/* Add note */}
              {onAddFact && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      value={newFactContent}
                      onChange={(e) => setNewFactContent(e.target.value)}
                      placeholder="Add a note..."
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newFactContent.trim()) {
                          e.preventDefault();
                          onAddFact(newFactContent.trim(), newFactEntity, newFactCategory);
                          setNewFactContent('');
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!newFactContent.trim()) return;
                        onAddFact(newFactContent.trim(), newFactEntity, newFactCategory);
                        setNewFactContent('');
                      }}
                      disabled={!newFactContent.trim()}
                      className="h-8"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    <Select value={newFactEntity} onValueChange={(v) => setNewFactEntity(v as ChatFactEntity)}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contact">About them</SelectItem>
                        <SelectItem value="user">About me</SelectItem>
                        <SelectItem value="conversation">Conversation</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={newFactCategory} onValueChange={(v) => setNewFactCategory(v as ChatFactCategory)}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="preference">Preference</SelectItem>
                        <SelectItem value="schedule">Schedule</SelectItem>
                        <SelectItem value="relationship">Relationship</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="topic">Topic</SelectItem>
                        <SelectItem value="sentiment">Sentiment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {!knowledge || (
                !knowledge.contactFacts?.length &&
                !knowledge.conversationFacts?.length &&
                !knowledge.userFacts?.length &&
                !knowledge.conversationTone &&
                !knowledge.relationshipType &&
                !knowledge.topicHistory?.length
              ) ? (
                <p className="text-xs text-muted-foreground">No knowledge extracted yet. Activate an agent in observer mode to start learning.</p>
              ) : (
                <div className="space-y-3">
                  {/* Conversation metadata */}
                  {(knowledge.conversationTone || knowledge.primaryLanguage || knowledge.relationshipType) && (
                    <div className="flex flex-wrap gap-1.5">
                      {knowledge.relationshipType && (
                        <Badge variant="secondary" className="text-xs">
                          {knowledge.relationshipType}
                        </Badge>
                      )}
                      {knowledge.conversationTone && (
                        <Badge variant="outline" className="text-xs">
                          {knowledge.conversationTone}
                        </Badge>
                      )}
                      {knowledge.primaryLanguage && (
                        <Badge variant="outline" className="text-xs">
                          {knowledge.primaryLanguage}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Topic history */}
                  {knowledge.topicHistory?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Recent topics</span>
                      <div className="flex flex-wrap gap-1.5">
                        {knowledge.topicHistory.slice(-5).map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-xs font-normal">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fact groups */}
                  {([
                    { key: 'contactFacts', label: 'About them', facts: knowledge.contactFacts },
                    { key: 'conversationFacts', label: 'Conversation', facts: knowledge.conversationFacts },
                    { key: 'userFacts', label: 'About me', facts: knowledge.userFacts },
                  ] as const).map(({ key, label, facts }) => {
                    if (!facts?.length) return null;
                    const isExpanded = expandedKnowledgeGroups.has(key);

                    return (
                      <div key={key} className="space-y-2">
                        <button
                          onClick={() => {
                            setExpandedKnowledgeGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground">({facts.length})</span>
                        </button>

                        {isExpanded && (
                          <div className="space-y-1.5 pl-1">
                            {facts
                              .sort((a, b) => b.confidence - a.confidence)
                              .map(fact => (
                                <div key={fact.id} className="group/fact p-2 rounded-lg bg-muted/50 space-y-0.5">
                                  <div className="flex items-start gap-1">
                                    <p className="text-xs leading-relaxed flex-1">{fact.content}</p>
                                    {onRemoveFact && (
                                      <button
                                        onClick={() => onRemoveFact(fact.id, key === 'contactFacts' ? 'contact' : key === 'userFacts' ? 'user' : 'conversation')}
                                        className="shrink-0 opacity-0 group-hover/fact:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        title="Remove"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-muted-foreground" title={fact.source}>
                                      {fact.source === 'observed' && <Eye className="h-3 w-3" />}
                                      {fact.source === 'stated' && <MessageSquare className="h-3 w-3" />}
                                      {fact.source === 'inferred' && <Lightbulb className="h-3 w-3" />}
                                      {fact.source === 'manual' && <Pencil className="h-3 w-3" />}
                                      <span className="text-[10px] capitalize">{fact.source}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                                      {fact.category}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attachments */}
            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Paperclip className="h-3 w-3" />
                  Attachments
                </h3>
                {onAddAttachments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAddAttachments}
                    className="h-6 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    <span className="text-xs">Add</span>
                  </Button>
                )}
              </div>

              {(!contact.attachments || contact.attachments.length === 0) ? (
                <p className="text-xs text-muted-foreground">No attachments. Add PDFs, images, or documents.</p>
              ) : (
                <div className="space-y-1.5">
                  {contact.attachments.map((att) => {
                    const isImage = att.mimeType.startsWith('image/');
                    const isPdf = att.mimeType === 'application/pdf';
                    const AttIcon = isImage ? ImageIcon : isPdf ? FileText : File;

                    return (
                      <div
                        key={att.id}
                        className="group/att flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        {/* Thumbnail or icon */}
                        {isImage ? (
                          <div className="h-8 w-8 rounded overflow-hidden shrink-0 bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/attachments?name=${encodeURIComponent(att.storedName)}`}
                              alt={att.fileName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <AttIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{att.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatFileSize(att.fileSize)}
                            {att.note && ` · ${att.note}`}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/att:opacity-100 transition-opacity">
                          <a
                            href={`/api/attachments?name=${encodeURIComponent(att.storedName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Open"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          {onRemoveAttachment && (
                            <button
                              onClick={() => onRemoveAttachment(att.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Save button */}
        {isDirty && (
          <div className="shrink-0 p-4 border-t">
            <Button onClick={handleSave} className="w-full" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Merge dialog */}
      <ContactMergeDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        sourceContact={contact}
        allContacts={allContacts}
        tags={tags}
        onMerge={onMerge || (() => {})}
        onLinkNewPlatform={onLinkPlatform}
      />

    </div>
  );
}
