import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/settings-context";
import { AutopilotProvider } from "@/contexts/autopilot-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Parrot",
  description: "Manage your messages with a Kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsProvider>
            <AutopilotProvider>
              {children}
              <Toaster />
            </AutopilotProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
