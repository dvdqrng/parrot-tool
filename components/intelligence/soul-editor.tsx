'use client';

/**
 * Soul Editor
 * Review/edit UI for auto-extracted identity traits + manual overrides.
 * Traits are auto-extracted from sent messages by the background worker.
 * Users can pin, edit, delete traits and set manual overrides.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, X, Plus, Check, Loader2, Pin, PinOff, Pencil, Trash2,
  ChevronDown, ChevronRight, Brain,
} from 'lucide-react';
import { soulStore } from '@/lib/intelligence/knowledge/store';
import { UserSoul, SoulTrait, SoulTraitCategory, createDefaultSoul } from '@/lib/intelligence/user-state/soul';
import { eventBus } from '@/lib/intelligence/event-bus';

// ============================================
// TRAIT CATEGORY LABELS
// ============================================

const CATEGORY_LABELS: Record<SoulTraitCategory, string> = {
  personality: 'Personality',
  communication_style: 'Communication Style',
  value: 'Values',
  background: 'Background',
  habit: 'Habits',
  preference: 'Preferences',
  identity: 'Identity',
};

const CATEGORY_ORDER: SoulTraitCategory[] = [
  'identity', 'personality', 'communication_style', 'background',
  'value', 'preference', 'habit',
];

// ============================================
// TAG INPUT COMPONENT
// ============================================

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!input.trim()}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// TRAIT ITEM COMPONENT
// ============================================

function TraitItem({
  trait,
  onPin,
  onEdit,
  onDelete,
}: {
  trait: SoulTrait;
  onPin: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(trait.content);
  const [showEvidence, setShowEvidence] = useState(false);

  const handleSaveEdit = () => {
    if (editValue.trim()) {
      onEdit(trait.id, editValue.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="group flex flex-col gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50">
      <div className="flex items-start gap-2">
        {/* Pin indicator */}
        {trait.userVerified && (
          <Pin className="h-3 w-3 text-primary mt-0.5 shrink-0" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex gap-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="text-xs h-7"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveEdit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className="text-xs leading-relaxed">
              {trait.content}
              {trait.userEdited && (
                <span className="text-muted-foreground ml-1">(edited)</span>
              )}
            </p>
          )}
        </div>

        {/* Confidence badge */}
        <Badge
          variant="outline"
          className="text-[10px] shrink-0 tabular-nums"
        >
          {Math.round(trait.confidence * 100)}%
        </Badge>

        {/* Actions (visible on hover) */}
        {!isEditing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => onPin(trait.id)}
              title={trait.userVerified ? 'Unpin' : 'Pin (survives re-extraction)'}
            >
              {trait.userVerified ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => { setEditValue(trait.content); setIsEditing(true); }}
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:text-destructive"
              onClick={() => onDelete(trait.id)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Evidence (expandable) */}
      {trait.evidence.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground ml-5"
          onClick={() => setShowEvidence(!showEvidence)}
        >
          {showEvidence ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          {trait.evidence.length} evidence snippet{trait.evidence.length !== 1 ? 's' : ''}
        </button>
      )}
      {showEvidence && trait.evidence.length > 0 && (
        <div className="ml-5 space-y-0.5">
          {trait.evidence.map((e, i) => (
            <p key={i} className="text-[10px] text-muted-foreground italic truncate">
              &ldquo;{e}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SOUL EDITOR
// ============================================

export function SoulEditor() {
  const [soul, setSoul] = useState<UserSoul>(createDefaultSoul());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);

  // Load soul from store
  useEffect(() => {
    soulStore.get().then((loaded) => {
      setSoul(loaded);
      setIsLoading(false);
    });
  }, []);

  // Subscribe to soul_updated events for auto-refresh
  useEffect(() => {
    const unsubscribe = eventBus.on('soul_updated', async () => {
      const updated = await soulStore.get();
      setSoul(updated);
    });
    return unsubscribe;
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await soulStore.set({
        ...soul,
        updatedAt: new Date().toISOString(),
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Failed to save soul:', e);
    } finally {
      setIsSaving(false);
    }
  }, [soul]);

  // Update helpers
  const update = (key: keyof UserSoul, value: unknown) => {
    setSoul((prev) => ({ ...prev, [key]: value }));
    setLastSaved(null);
  };

  const addTag = (key: 'toneKeywords' | 'neverDo' | 'alwaysDo', tag: string) => {
    setSoul((prev) => ({ ...prev, [key]: [...prev[key], tag] }));
    setLastSaved(null);
  };

  const removeTag = (key: 'toneKeywords' | 'neverDo' | 'alwaysDo', index: number) => {
    setSoul((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
    setLastSaved(null);
  };

  // Trait action handlers
  const handlePinTrait = useCallback(async (traitId: string) => {
    setSoul((prev) => {
      const updated = {
        ...prev,
        extractedTraits: prev.extractedTraits.map(t =>
          t.id === traitId ? { ...t, userVerified: !t.userVerified } : t
        ),
      };
      soulStore.set({ ...updated, updatedAt: new Date().toISOString() });
      return updated;
    });
  }, []);

  const handleEditTrait = useCallback(async (traitId: string, content: string) => {
    setSoul((prev) => {
      const updated = {
        ...prev,
        extractedTraits: prev.extractedTraits.map(t =>
          t.id === traitId ? { ...t, content, userEdited: true } : t
        ),
      };
      soulStore.set({ ...updated, updatedAt: new Date().toISOString() });
      return updated;
    });
  }, []);

  const handleDeleteTrait = useCallback(async (traitId: string) => {
    setSoul((prev) => {
      const updated = {
        ...prev,
        extractedTraits: prev.extractedTraits.map(t =>
          t.id === traitId ? { ...t, isActive: false } : t
        ),
      };
      soulStore.set({ ...updated, updatedAt: new Date().toISOString() });
      return updated;
    });
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Group active traits by category
  const activeTraits = (soul.extractedTraits || []).filter(t => t.isActive);
  const traitsByCategory = new Map<SoulTraitCategory, SoulTrait[]>();
  for (const trait of activeTraits) {
    const list = traitsByCategory.get(trait.category) || [];
    list.push(trait);
    traitsByCategory.set(trait.category, list);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Your Identity
        </CardTitle>
        <CardDescription className="text-xs">
          Auto-extracted from your messages across all chats. Pin traits to protect them, edit to refine, or delete to remove.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Extraction status */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {activeTraits.length} trait{activeTraits.length !== 1 ? 's' : ''} extracted
            {activeTraits.filter(t => t.userVerified).length > 0 && (
              <> ({activeTraits.filter(t => t.userVerified).length} pinned)</>
            )}
          </span>
          {soul.lastExtractionAt && (
            <span>Last extraction: {new Date(soul.lastExtractionAt).toLocaleString()}</span>
          )}
        </div>

        {/* Extracted traits grouped by category */}
        {activeTraits.length > 0 ? (
          <div className="space-y-3">
            {CATEGORY_ORDER.filter(cat => traitsByCategory.has(cat)).map(category => {
              const traits = traitsByCategory.get(category)!;
              const sorted = [...traits].sort((a, b) => {
                // Pinned first, then by confidence
                if (a.userVerified && !b.userVerified) return -1;
                if (!a.userVerified && b.userVerified) return 1;
                return b.confidence - a.confidence;
              });

              return (
                <div key={category}>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">
                    {CATEGORY_LABELS[category]}
                  </h4>
                  <div className="space-y-0.5">
                    {sorted.map(trait => (
                      <TraitItem
                        key={trait.id}
                        trait={trait}
                        onPin={handlePinTrait}
                        onEdit={handleEditTrait}
                        onDelete={handleDeleteTrait}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">
            No traits extracted yet. The system will automatically learn about you from your messages.
          </div>
        )}

        <Separator />

        {/* Manual overrides (collapsible) */}
        <button
          type="button"
          className="flex items-center gap-2 text-xs font-medium w-full"
          onClick={() => setShowOverrides(!showOverrides)}
        >
          {showOverrides ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <User className="h-3 w-3" />
          Manual Overrides
          <span className="text-muted-foreground font-normal">
            {soul.name || soul.bio || soul.toneKeywords.length > 0
              ? '(configured)'
              : '(optional)'}
          </span>
        </button>

        {showOverrides && (
          <div className="space-y-4 pl-5 border-l-2 border-muted">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="soul-name" className="text-xs">Name</Label>
              <Input
                id="soul-name"
                value={soul.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Your name"
                className="text-xs"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="soul-bio" className="text-xs">Bio</Label>
              <Textarea
                id="soul-bio"
                value={soul.bio}
                onChange={(e) => update('bio', e.target.value)}
                placeholder="A few words about yourself — startup founder, parent of two, lives in SF..."
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Tone Keywords */}
            <div className="space-y-1.5">
              <Label className="text-xs">Communication Style</Label>
              <TagInput
                tags={soul.toneKeywords}
                onAdd={(tag) => addTag('toneKeywords', tag)}
                onRemove={(i) => removeTag('toneKeywords', i)}
                placeholder="e.g. sarcastic, warm, direct"
              />
            </div>

            {/* Formality */}
            <div className="space-y-1.5">
              <Label className="text-xs">Default Formality</Label>
              <Select
                value={soul.defaultFormality}
                onValueChange={(v) => update('defaultFormality', v)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset" className="text-xs">Not set</SelectItem>
                  <SelectItem value="formal" className="text-xs">Formal</SelectItem>
                  <SelectItem value="casual" className="text-xs">Casual</SelectItem>
                  <SelectItem value="match_them" className="text-xs">Match the other person</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Always Do */}
            <div className="space-y-1.5">
              <Label className="text-xs">Always Do</Label>
              <TagInput
                tags={soul.alwaysDo}
                onAdd={(tag) => addTag('alwaysDo', tag)}
                onRemove={(i) => removeTag('alwaysDo', i)}
                placeholder="e.g. use lowercase, include context when replying late"
              />
            </div>

            {/* Never Do */}
            <div className="space-y-1.5">
              <Label className="text-xs">Never Do</Label>
              <TagInput
                tags={soul.neverDo}
                onAdd={(tag) => addTag('neverDo', tag)}
                onRemove={(i) => removeTag('neverDo', i)}
                placeholder="e.g. use exclamation marks, say 'no worries'"
              />
            </div>

            {/* Custom System Prompt */}
            <div className="space-y-1.5">
              <Label htmlFor="soul-prompt" className="text-xs">Custom Instructions (Advanced)</Label>
              <Textarea
                id="soul-prompt"
                value={soul.customSystemPrompt}
                onChange={(e) => update('customSystemPrompt', e.target.value)}
                placeholder="When drafting for me, always..."
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {lastSaved
              ? `Saved at ${lastSaved}`
              : soul.updatedAt
                ? `Last saved ${new Date(soul.updatedAt).toLocaleDateString()}`
                : 'Not saved yet'}
          </div>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs">
            {isSaving ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
