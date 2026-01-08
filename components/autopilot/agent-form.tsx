'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AutopilotAgent,
  AgentBehaviorSettings,
  GoalCompletionBehavior,
  DEFAULT_AGENT_BEHAVIOR,
} from '@/lib/types';
import {
  AGENT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  AgentTemplate,
} from '@/lib/agent-templates';

interface AgentFormProps {
  agent?: AutopilotAgent;
  onSave: (data: Omit<AutopilotAgent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function AgentForm({ agent, onSave, onCancel }: AgentFormProps) {
  const router = useRouter();
  const isEditing = !!agent;

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Basic info
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [goal, setGoal] = useState(agent?.goal || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || '');
  const [goalCompletionBehavior, setGoalCompletionBehavior] = useState<GoalCompletionBehavior>(
    agent?.goalCompletionBehavior || 'auto-disable'
  );

  // Behavior settings
  const [behavior, setBehavior] = useState<AgentBehaviorSettings>(
    agent?.behavior || DEFAULT_AGENT_BEHAVIOR
  );

  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timing: true,
    activity: false,
    typing: false,
    multiMessage: false,
    humanBehavior: false,
  });

  // Apply template to form
  const applyTemplate = (template: AgentTemplate) => {
    setSelectedTemplate(template.id);
    setName(template.name);
    setDescription(template.description);
    setGoal(template.goal);
    setSystemPrompt(template.systemPrompt);
    setGoalCompletionBehavior(template.goalCompletionBehavior);
    setBehavior({ ...template.behavior });
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateBehavior = <K extends keyof AgentBehaviorSettings>(
    key: K,
    value: AgentBehaviorSettings[K]
  ) => {
    setBehavior(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!name.trim() || !goal.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      goal: goal.trim(),
      systemPrompt: systemPrompt.trim(),
      behavior,
      goalCompletionBehavior,
    });
  };

  const isValid = name.trim() && goal.trim();

  // Group templates by category
  const templatesByCategory = Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => ({
    key: key as AgentTemplate['category'],
    ...category,
    templates: AGENT_TEMPLATES.filter(t => t.category === key),
  }));

  return (
    <div className="space-y-6">
      {/* Template Selector - only show for new agents */}
      {!isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Start from Template
            </CardTitle>
            <CardDescription className="text-xs">
              Choose a pre-configured template to get started quickly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {templatesByCategory.map(category => (
              <div key={category.key} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span>{category.emoji}</span>
                  <span>{category.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {category.templates.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className={`
                        flex items-start gap-2 p-3 rounded-lg border text-left transition-colors
                        hover:bg-accent hover:border-accent-foreground/20
                        ${selectedTemplate === template.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                        }
                      `}
                    >
                      <span className="text-lg flex-shrink-0">{template.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{template.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {template.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {selectedTemplate && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Template applied - customize below
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setName('');
                    setDescription('');
                    setGoal('');
                    setSystemPrompt('');
                    setGoalCompletionBehavior('auto-disable');
                    setBehavior(DEFAULT_AGENT_BEHAVIOR);
                  }}
                  className="text-xs h-7"
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Basic Information</CardTitle>
          <CardDescription className="text-xs">
            Name and describe your agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting Scheduler"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Schedules meetings with prospects"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Goal & Personality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Goal & Personality</CardTitle>
          <CardDescription className="text-xs">
            Define what this agent aims to achieve
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal" className="text-xs">Goal *</Label>
            <Input
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Schedule a meeting"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The agent will work towards this goal and detect when it&apos;s achieved.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemPrompt" className="text-xs">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a friendly assistant helping to schedule meetings. Be polite, professional, and suggest specific times when appropriate..."
              className="text-sm min-h-[120px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Custom instructions for the AI&apos;s personality and behavior.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">When Goal is Achieved</Label>
            <Select
              value={goalCompletionBehavior}
              onValueChange={(v: string) => setGoalCompletionBehavior(v as GoalCompletionBehavior)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto-disable">Auto-disable (stop responding)</SelectItem>
                <SelectItem value="maintenance">Maintenance mode (lighter engagement)</SelectItem>
                <SelectItem value="handoff">Handoff (notify with summary)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Human-like Behavior</CardTitle>
          <CardDescription className="text-xs">
            Configure timing and behavior to appear more natural
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reply Timing */}
          <Collapsible open={openSections.timing} onOpenChange={() => toggleSection('timing')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
              Reply Timing
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.timing ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span>Minimum delay</span>
                  <span className="font-mono">{behavior.replyDelayMin}s</span>
                </div>
                <Slider
                  value={[behavior.replyDelayMin]}
                  onValueChange={([v]) => updateBehavior('replyDelayMin', v)}
                  min={5}
                  max={600}
                  step={5}
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span>Maximum delay</span>
                  <span className="font-mono">{behavior.replyDelayMax}s</span>
                </div>
                <Slider
                  value={[behavior.replyDelayMax]}
                  onValueChange={([v]) => updateBehavior('replyDelayMax', Math.max(v, behavior.replyDelayMin))}
                  min={10}
                  max={1800}
                  step={10}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Context-aware timing</Label>
                  <p className="text-xs text-muted-foreground">
                    Reply faster in active conversations
                  </p>
                </div>
                <Switch
                  checked={behavior.replyDelayContextAware}
                  onCheckedChange={(v) => updateBehavior('replyDelayContextAware', v)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Hours */}
          <Collapsible open={openSections.activity} onOpenChange={() => toggleSection('activity')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
              Activity Hours
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.activity ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Limit activity hours</Label>
                  <p className="text-xs text-muted-foreground">
                    Only respond during specified hours
                  </p>
                </div>
                <Switch
                  checked={behavior.activityHoursEnabled}
                  onCheckedChange={(v) => updateBehavior('activityHoursEnabled', v)}
                />
              </div>
              {behavior.activityHoursEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Start hour</Label>
                      <Select
                        value={behavior.activityHoursStart.toString()}
                        onValueChange={(v: string) => updateBehavior('activityHoursStart', parseInt(v))}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">End hour</Label>
                      <Select
                        value={behavior.activityHoursEnd.toString()}
                        onValueChange={(v: string) => updateBehavior('activityHoursEnd', parseInt(v))}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Timezone</Label>
                    <Select
                      value={behavior.activityHoursTimezone}
                      onValueChange={(v: string) => updateBehavior('activityHoursTimezone', v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Typing & Read Receipts */}
          <Collapsible open={openSections.typing} onOpenChange={() => toggleSection('typing')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
              Typing & Read Receipts
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.typing ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Typing indicator</Label>
                  <p className="text-xs text-muted-foreground">
                    Show typing before sending (if supported)
                  </p>
                </div>
                <Switch
                  checked={behavior.typingIndicatorEnabled}
                  onCheckedChange={(v) => updateBehavior('typingIndicatorEnabled', v)}
                />
              </div>
              {behavior.typingIndicatorEnabled && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span>Typing speed</span>
                    <span className="font-mono">{behavior.typingSpeedWpm} WPM</span>
                  </div>
                  <Slider
                    value={[behavior.typingSpeedWpm]}
                    onValueChange={([v]) => updateBehavior('typingSpeedWpm', v)}
                    min={20}
                    max={100}
                    step={5}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Read receipts</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark as read before responding (if supported)
                  </p>
                </div>
                <Switch
                  checked={behavior.readReceiptEnabled}
                  onCheckedChange={(v) => updateBehavior('readReceiptEnabled', v)}
                />
              </div>
              {behavior.readReceiptEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>Min delay</span>
                      <span className="font-mono">{behavior.readReceiptDelayMin}s</span>
                    </div>
                    <Slider
                      value={[behavior.readReceiptDelayMin]}
                      onValueChange={([v]) => updateBehavior('readReceiptDelayMin', v)}
                      min={1}
                      max={60}
                      step={1}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>Max delay</span>
                      <span className="font-mono">{behavior.readReceiptDelayMax}s</span>
                    </div>
                    <Slider
                      value={[behavior.readReceiptDelayMax]}
                      onValueChange={([v]) => updateBehavior('readReceiptDelayMax', Math.max(v, behavior.readReceiptDelayMin))}
                      min={5}
                      max={120}
                      step={5}
                    />
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Multi-message */}
          <Collapsible open={openSections.multiMessage} onOpenChange={() => toggleSection('multiMessage')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
              Multi-message Splitting
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.multiMessage ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Split long messages</Label>
                  <p className="text-xs text-muted-foreground">
                    Send multiple shorter messages like a human
                  </p>
                </div>
                <Switch
                  checked={behavior.multiMessageEnabled}
                  onCheckedChange={(v) => updateBehavior('multiMessageEnabled', v)}
                />
              </div>
              {behavior.multiMessageEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>Min delay between</span>
                      <span className="font-mono">{behavior.multiMessageDelayMin}s</span>
                    </div>
                    <Slider
                      value={[behavior.multiMessageDelayMin]}
                      onValueChange={([v]) => updateBehavior('multiMessageDelayMin', v)}
                      min={1}
                      max={30}
                      step={1}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>Max delay between</span>
                      <span className="font-mono">{behavior.multiMessageDelayMax}s</span>
                    </div>
                    <Slider
                      value={[behavior.multiMessageDelayMax]}
                      onValueChange={([v]) => updateBehavior('multiMessageDelayMax', Math.max(v, behavior.multiMessageDelayMin))}
                      min={3}
                      max={60}
                      step={1}
                    />
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Human-like Behaviors */}
          <Collapsible open={openSections.humanBehavior} onOpenChange={() => toggleSection('humanBehavior')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium border-t pt-4">
              Advanced Human Behaviors
              <ChevronDown className={`h-4 w-4 transition-transform ${openSections.humanBehavior ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Response Rate */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span>Response rate</span>
                  <span className="font-mono">{behavior.responseRate ?? 100}%</span>
                </div>
                <Slider
                  value={[behavior.responseRate ?? 100]}
                  onValueChange={([v]) => updateBehavior('responseRate', v)}
                  min={30}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Simulate being busy - lower values mean some messages won&apos;t get a response
                </p>
              </div>

              {/* Emoji-only responses */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label className="text-xs">Emoji-only responses</Label>
                  <p className="text-xs text-muted-foreground">
                    Sometimes respond with just an emoji
                  </p>
                </div>
                <Switch
                  checked={behavior.emojiOnlyResponseEnabled ?? false}
                  onCheckedChange={(v) => updateBehavior('emojiOnlyResponseEnabled', v)}
                />
              </div>
              {behavior.emojiOnlyResponseEnabled && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span>Emoji-only chance</span>
                    <span className="font-mono">{behavior.emojiOnlyResponseChance ?? 10}%</span>
                  </div>
                  <Slider
                    value={[behavior.emojiOnlyResponseChance ?? 10]}
                    onValueChange={([v]) => updateBehavior('emojiOnlyResponseChance', v)}
                    min={5}
                    max={30}
                    step={5}
                  />
                </div>
              )}

              {/* Conversation fatigue */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label className="text-xs">Conversation fatigue</Label>
                  <p className="text-xs text-muted-foreground">
                    Reduce engagement in longer conversations
                  </p>
                </div>
                <Switch
                  checked={behavior.conversationFatigueEnabled ?? false}
                  onCheckedChange={(v) => updateBehavior('conversationFatigueEnabled', v)}
                />
              </div>
              {behavior.conversationFatigueEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>After messages</span>
                      <span className="font-mono">{behavior.fatigueTriggerMessages ?? 15}</span>
                    </div>
                    <Slider
                      value={[behavior.fatigueTriggerMessages ?? 15]}
                      onValueChange={([v]) => updateBehavior('fatigueTriggerMessages', v)}
                      min={5}
                      max={50}
                      step={5}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span>Reduction per msg</span>
                      <span className="font-mono">{behavior.fatigueResponseReduction ?? 5}%</span>
                    </div>
                    <Slider
                      value={[behavior.fatigueResponseReduction ?? 5]}
                      onValueChange={([v]) => updateBehavior('fatigueResponseReduction', v)}
                      min={1}
                      max={15}
                      step={1}
                    />
                  </div>
                </div>
              )}

              {/* Natural closing */}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label className="text-xs">Natural conversation closing</Label>
                  <p className="text-xs text-muted-foreground">
                    Suggest wrapping up after periods of inactivity
                  </p>
                </div>
                <Switch
                  checked={behavior.conversationClosingEnabled ?? false}
                  onCheckedChange={(v) => updateBehavior('conversationClosingEnabled', v)}
                />
              </div>
              {behavior.conversationClosingEnabled && (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span>Idle time before suggesting close</span>
                    <span className="font-mono">{behavior.closingTriggerIdleMinutes ?? 30} min</span>
                  </div>
                  <Slider
                    value={[behavior.closingTriggerIdleMinutes ?? 30]}
                    onValueChange={([v]) => updateBehavior('closingTriggerIdleMinutes', v)}
                    min={10}
                    max={120}
                    step={5}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" strokeWidth={2} />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          <Save className="h-4 w-4 mr-2" strokeWidth={2} />
          {isEditing ? 'Save Changes' : 'Create Agent'}
        </Button>
      </div>
    </div>
  );
}
