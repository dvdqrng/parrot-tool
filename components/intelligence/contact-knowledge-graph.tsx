'use client';

/**
 * Contact Knowledge Graph
 *
 * Visualizes the AI-extracted knowledge about a contact:
 * - Facts organized by category
 * - Relationship classification
 * - Action items
 * - Style profile
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  MapPin,
  Briefcase,
  Heart,
  Star,
  Calendar,
  Phone,
  User,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { contactStore } from '@/lib/intelligence/knowledge/store';
import {
  ContactIntelligence,
  ContactFact,
  FactCategory,
  RelationshipType,
  ActionItem,
} from '@/lib/intelligence/knowledge/types';

// ============================================
// HELPERS
// ============================================

function getCategoryIcon(category: FactCategory) {
  switch (category) {
    case 'location':
      return <MapPin className="h-3 w-3" />;
    case 'occupation':
    case 'professional':
      return <Briefcase className="h-3 w-3" />;
    case 'relationship':
      return <Heart className="h-3 w-3" />;
    case 'preference':
    case 'interest':
      return <Star className="h-3 w-3" />;
    case 'plan':
    case 'event':
      return <Calendar className="h-3 w-3" />;
    case 'contact_info':
      return <Phone className="h-3 w-3" />;
    case 'personal':
      return <User className="h-3 w-3" />;
    default:
      return <Sparkles className="h-3 w-3" />;
  }
}

function getCategoryColor(category: FactCategory): string {
  switch (category) {
    case 'location':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'occupation':
    case 'professional':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'relationship':
      return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
    case 'preference':
    case 'interest':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'plan':
    case 'event':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'contact_info':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
    case 'personal':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

function getRelationshipLabel(type: RelationshipType): string {
  switch (type) {
    case 'close_friend':
      return 'Close Friend';
    case 'friend':
      return 'Friend';
    case 'acquaintance':
      return 'Acquaintance';
    case 'professional':
      return 'Professional';
    case 'family':
      return 'Family';
    case 'romantic':
      return 'Romantic';
    case 'service_provider':
      return 'Service Provider';
    default:
      return 'Unknown';
  }
}

function getRelationshipColor(type: RelationshipType): string {
  switch (type) {
    case 'close_friend':
      return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
    case 'friend':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'family':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'romantic':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'professional':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    case 'service_provider':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// FACT ITEM COMPONENT
// ============================================

function FactItem({ fact }: { fact: ContactFact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-2 rounded-lg border text-xs',
        getCategoryColor(fact.category)
      )}
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          {getCategoryIcon(fact.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="break-words">{fact.content}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] opacity-60">
            <span>{formatDate(fact.firstSeen)}</span>
            {fact.confidence < 0.8 && (
              <span>• {Math.round(fact.confidence * 100)}% confident</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// ACTION ITEM COMPONENT
// ============================================

function ActionItemComponent({ item }: { item: ActionItem }) {
  const statusIcon = item.status === 'completed'
    ? <CheckCircle2 className="h-3 w-3 text-green-500" />
    : item.status === 'expired'
      ? <AlertCircle className="h-3 w-3 text-red-500" />
      : <Clock className="h-3 w-3 text-amber-500" />;

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'break-words',
          item.status === 'completed' && 'line-through opacity-60'
        )}>
          {item.content}
        </p>
        {item.dueDate && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Due: {formatDate(item.dueDate)}
          </p>
        )}
      </div>
      <Badge
        variant="secondary"
        className={cn(
          'text-[10px] px-1.5 py-0',
          item.commitment === 'firm' && 'bg-blue-500/10 text-blue-600',
          item.commitment === 'soft' && 'bg-amber-500/10 text-amber-600',
          item.commitment === 'social_pleasantry' && 'bg-gray-500/10 text-gray-600'
        )}
      >
        {item.commitment}
      </Badge>
    </div>
  );
}

// ============================================
// CATEGORY SECTION COMPONENT
// ============================================

function CategorySection({
  category,
  facts,
  defaultOpen = true,
}: {
  category: FactCategory;
  facts: ContactFact[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (facts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {getCategoryIcon(category)}
        <span className="capitalize">{category.replace('_', ' ')}</span>
        <span className="text-[10px] opacity-60">({facts.length})</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-1.5 pl-4 overflow-hidden"
          >
            {facts.map((fact) => (
              <FactItem key={fact.id} fact={fact} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ContactKnowledgeGraphProps {
  chatId: string;
  contactName?: string;
  className?: string;
}

export function ContactKnowledgeGraph({
  chatId,
  contactName,
  className,
}: ContactKnowledgeGraphProps) {
  const [intelligence, setIntelligence] = useState<ContactIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load contact intelligence
  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);
    contactStore.getByChatId(chatId).then((data) => {
      setIntelligence(data || null);
      setIsLoading(false);
    });
  }, [chatId]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!intelligence || (intelligence.facts.length === 0 && intelligence.actionItems.length === 0)) {
    return (
      <div className={cn('text-center py-6', className)}>
        <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          No knowledge extracted yet
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Enable AI to start learning about {contactName || 'this contact'}
        </p>
      </div>
    );
  }

  // Group facts by category
  const factsByCategory = intelligence.facts
    .filter(f => f.isActive)
    .reduce((acc, fact) => {
      if (!acc[fact.category]) {
        acc[fact.category] = [];
      }
      acc[fact.category].push(fact);
      return acc;
    }, {} as Record<FactCategory, ContactFact[]>);

  // Sort categories by count (most facts first)
  const sortedCategories = Object.entries(factsByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category]) => category as FactCategory);

  const pendingActions = intelligence.actionItems.filter(
    a => a.status === 'pending'
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Relationship badge */}
      {intelligence.relationship.type !== 'unknown' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Relationship:</span>
          <Badge
            variant="secondary"
            className={cn('text-xs', getRelationshipColor(intelligence.relationship.type))}
          >
            {getRelationshipLabel(intelligence.relationship.type)}
          </Badge>
          {intelligence.relationship.confidence < 0.8 && (
            <span className="text-[10px] text-muted-foreground">
              ({Math.round(intelligence.relationship.confidence * 100)}%)
            </span>
          )}
        </div>
      )}

      {/* AI Summary */}
      {intelligence.summary && (
        <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="h-3 w-3 text-violet-500" />
            <span className="text-xs font-medium text-violet-600">AI Summary</span>
          </div>
          <p className="text-xs text-muted-foreground">{intelligence.summary}</p>
        </div>
      )}

      {/* Facts by category */}
      {sortedCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Known Facts ({intelligence.facts.filter(f => f.isActive).length})
            </span>
          </div>

          <div className="space-y-3">
            {sortedCategories.map((category) => (
              <CategorySection
                key={category}
                category={category}
                facts={factsByCategory[category]}
                defaultOpen={sortedCategories.indexOf(category) < 3}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {pendingActions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Action Items ({pendingActions.length})
            </span>
          </div>

          <div className="space-y-1.5">
            {pendingActions.map((item) => (
              <ActionItemComponent key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Last extraction info */}
      {intelligence.lastExtractionAt && (
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Last updated: {formatDate(intelligence.lastExtractionAt)}
        </p>
      )}
    </div>
  );
}
