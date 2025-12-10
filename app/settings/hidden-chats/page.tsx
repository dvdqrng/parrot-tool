'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadHiddenChats, loadHiddenChatsWithMeta, removeHiddenChat, clearAllHiddenChats, loadCachedMessages, loadCachedAvatars, loadCachedChatInfo } from '@/lib/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlatformIcon } from '@/components/platform-icon';
import { toast } from 'sonner';

export default function HiddenChatsPage() {
  const [hiddenChatIds, setHiddenChatIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const hidden = loadHiddenChats();
    setHiddenChatIds(hidden);
  }, []);

  const cachedMessages = loadCachedMessages();
  const cachedAvatars = loadCachedAvatars();
  const cachedChatInfo = loadCachedChatInfo();
  const hiddenChatsMeta = loadHiddenChatsWithMeta();

  const hiddenChatsData = Array.from(hiddenChatIds).map(chatId => {
    const chatInfo = cachedChatInfo[chatId];
    const hiddenMeta = hiddenChatsMeta.find(h => h.chatId === chatId);
    const chatMessages = cachedMessages.filter(m => m.chatId === chatId);
    const latestMessage = chatMessages[0];

    const avatarUrl = cachedAvatars[chatId] || hiddenMeta?.avatarUrl;
    const name = chatInfo?.title || hiddenMeta?.name || latestMessage?.chatName || latestMessage?.senderName || chatId;
    const platform = hiddenMeta?.platform || latestMessage?.platform;

    return {
      chatId,
      name,
      avatarUrl,
      platform,
      isGroup: chatInfo?.isGroup,
    };
  });

  const handleUnhideChat = (chatId: string) => {
    removeHiddenChat(chatId);
    setHiddenChatIds(prev => {
      const updated = new Set(prev);
      updated.delete(chatId);
      return updated;
    });
    toast.success('Chat unhidden');
  };

  const handleClearAllHidden = () => {
    clearAllHiddenChats();
    setHiddenChatIds(new Set());
    toast.success('All hidden chats cleared');
  };

  const getAvatarSrc = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('file://')) {
      return `/api/avatar?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Hidden Chats</h2>
        <p className="text-muted-foreground">
          Manage chats you&apos;ve hidden from the Kanban board
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                Hidden Conversations
              </CardTitle>
              <CardDescription>
                {hiddenChatsData.length} chat{hiddenChatsData.length !== 1 ? 's' : ''} hidden
              </CardDescription>
            </div>
            {hiddenChatsData.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAllHidden}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hiddenChatsData.length === 0 ? (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-muted-foreground">No hidden chats</p>
              <p className="text-sm text-muted-foreground">
                When you hide a chat from the Kanban board, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {hiddenChatsData.map((chat) => {
                const initials = chat.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={chat.chatId}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getAvatarSrc(chat.avatarUrl)} alt={chat.name} className="object-cover" />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      {chat.platform && (
                        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                          <PlatformIcon platform={chat.platform} className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{chat.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{chat.chatId}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnhideChat(chat.chatId)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Unhide
                    </Button>
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
