import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import '@/app/globals.css';
import ClientSuppression from '@/components/theme/ClientSuppression';

export const metadata: Metadata = {
  title: {
    default: 'Pillar — Remote Access Gateway',
    template: '%s | Pillar',
  },
  description: 'Self-hosted, secure browser-based remote-access gateway. Launch SSH, VNC, and RDP bridges to your servers with MFA protection.',
  keywords: ['remote access', 'SSH', 'VNC', 'RDP', 'gateway', 'self-hosted', 'Proxmox'],
  authors: [{ name: 'Pillar' }],
  creator: 'Pillar',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Pillar — Remote Access Gateway',
    description: 'Secure browser-based SSH, VNC, and RDP bridges. Multi-factor authentication, encrypted at rest.',
    siteName: 'Pillar',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Pillar — Remote Access Gateway',
    description: 'Secure browser-based SSH, VNC, and RDP bridges.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Pillar',
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {/* Gotcha #34: Client component suppressing aggressive browser extension console errors in dev */}
          <ClientSuppression />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
