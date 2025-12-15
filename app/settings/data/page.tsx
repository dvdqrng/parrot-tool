'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clearAllData, clearCachedData } from '@/lib/storage';

export default function DataSettingsPage() {
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showResyncDialog, setShowResyncDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = () => {
    setIsDeleting(true);
    clearAllData();
    setShowDeleteAllDialog(false);
    window.location.href = '/';
  };

  const handleResync = () => {
    setIsDeleting(true);
    clearCachedData();
    setShowResyncDialog(false);
    window.location.href = '/';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Management</h2>
        <p className="text-muted-foreground">
          Manage your locally stored data and cache
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
            Clear Cache & Resync
          </CardTitle>
          <CardDescription>
            Clear cached messages, contacts, and AI chat history, then resync from Beeper.
            This keeps your settings (API keys, tone preferences, hidden chats) but removes
            all cached data including participant names. Use this if you see stale or incorrect data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setShowResyncDialog(true)}
            disabled={isDeleting}
          >
            <RefreshCw className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Clear Cache & Resync
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            Delete All Data
          </CardTitle>
          <CardDescription>
            Permanently delete all locally stored data including drafts, cached messages,
            settings, and preferences. API keys are preserved. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Delete All Data
          </Button>
        </CardContent>
      </Card>

      {/* Resync Confirmation Dialog */}
      <Dialog open={showResyncDialog} onOpenChange={setShowResyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Cache & Resync?</DialogTitle>
            <DialogDescription>
              This will clear all cached messages and data, then redirect you to the home page
              where fresh data will be fetched from Beeper. Your settings (API keys, tone
              preferences, hidden chats) will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResyncDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResync}>
              Clear & Resync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
              Delete All Data?
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>This will permanently delete all locally stored data including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Draft messages</li>
                  <li>Cached messages and contacts</li>
                  <li>Tone and platform settings</li>
                  <li>Hidden chat preferences</li>
                  <li>AI chat history</li>
                </ul>
                <p className="mt-2">API keys will be preserved.</p>
                <p className="mt-2 font-medium">This action cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
