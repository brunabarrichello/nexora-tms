import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from './_components/app-shell';
import './globals.css';
import './workbench.css';

export const metadata: Metadata = {
  title: {
    default: 'Nexora TMS',
    template: '%s | Nexora TMS',
  },
  description: 'Transportation Management System para gestão de cargas rodoviárias.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
