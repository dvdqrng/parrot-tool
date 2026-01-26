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
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
