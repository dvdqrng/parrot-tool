interface UpdateStatus {
  status: 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error' | 'dev-mode';
  version?: string | null;
  percent?: number | null;
  error?: string | null;
}

interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ status: string; error?: string }>;
  installUpdate: () => void;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  // File attachments
  selectFiles: () => Promise<{ path: string; name: string; size: number }[] | null>;
  copyFileToAttachments: (sourcePath: string, storedName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  deleteAttachmentFile: (storedName: string) => Promise<{ success: boolean; error?: string }>;
  getAttachmentsPath: () => Promise<string>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
