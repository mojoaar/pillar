import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import '@/app/globals.css';
import ClientSuppression from '@/components/theme/ClientSuppression';

export const metadata: Metadata = {
  title: {
    default: 'Pillar',
    template: '%s | Pillar',
  },
  description: 'The bedrock of your home network - Secure browser-based remote-access gateway.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=1' }, // Gotcha #14: Cache-busting favicon queries
    ],
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
