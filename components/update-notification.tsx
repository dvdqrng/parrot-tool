'use client'

import { useUpdateCheck } from '@/hooks/use-update-check'
import { Button } from '@/components/ui/button'
import { X, Download, AlertTriangle } from 'lucide-react'

export function UpdateNotification() {
  const { updateAvailable, dismissUpdate, currentVersion } = useUpdateCheck()

  if (!updateAvailable) {
    return null
  }

  const handleDownload = () => {
    window.open(updateAvailable.downloadUrl, '_blank')
  }

  return (
    <div className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg border ${
      updateAvailable.isRequired
        ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        : 'bg-background border-border'
    }`}>
      <div className="flex items-start gap-3">
        {updateAvailable.isRequired ? (
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        ) : (
          <Download className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">
            {updateAvailable.isRequired ? 'Required Update Available' : 'Update Available'}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Version {updateAvailable.version} is available (current: {currentVersion})
          </p>

          {updateAvailable.releaseNotes && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {updateAvailable.releaseNotes}
            </p>
          )}

          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleDownload}>
              Download
            </Button>
            {!updateAvailable.isRequired && (
              <Button size="sm" variant="ghost" onClick={dismissUpdate}>
                Later
              </Button>
            )}
          </div>
        </div>

        {!updateAvailable.isRequired && (
          <button
            onClick={dismissUpdate}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
