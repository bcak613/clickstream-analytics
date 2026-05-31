import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DuckDBProvider } from '@/components/providers/DuckDBProvider';
import { LangProvider } from '@/components/providers/LangProvider';
import { SidebarProvider } from '@/components/providers/SidebarProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Clickstream Analytics Platform',
  description: 'Production-grade BI clickstream dashboard powered by Polars, DuckDB, and Next.js.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <body className="bg-surface min-h-screen text-on-surface">
        <LangProvider>
          <SidebarProvider>
            <DuckDBProvider>
              {/* Mobile top bar — hidden on md+ */}
              <MobileHeader />

              <div className="flex">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Content — pt-14 on mobile offsets fixed MobileHeader */}
                <main className="flex-1 overflow-y-auto px-4 md:px-6 py-4 pt-[72px] md:pt-4 min-w-0">
                  {children}
                </main>
              </div>
            </DuckDBProvider>
          </SidebarProvider>
        </LangProvider>
      </body>
    </html>
  );
}

