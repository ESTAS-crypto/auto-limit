import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-bricolage',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Quota Radar - Dashboard Kuota Antigravity',
  description: 'Pantau sisa kuota banyak akun Google di Google Antigravity & rotasi otomatis.',
  icons: {
    icon: '/assets/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-background text-foreground antialiased selection:bg-radar-green selection:text-radar-greenDark">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

