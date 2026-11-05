import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@/styles/globals.scss';
import { themeInitScript } from '@/lib/theme/ThemeProvider';
import { DemoBootstrap } from '@/components/layout/DemoBootstrap';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Fluxo', template: '%s · Fluxo' },
  description: 'Gerenciador de projetos colaborativo em tempo real.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/favicon.svg` },
};

export const viewport: Viewport = {
  themeColor: '#0b0d12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <DemoBootstrap>
          <Providers>{children}</Providers>
        </DemoBootstrap>
      </body>
    </html>
  );
}
