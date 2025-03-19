import React from 'react';
import { Inter } from 'next/font/google';
import './globals.css'; // Import the global CSS file with animations
import type { Metadata } from 'next'
import DevToolsMessage from './components/DevToolsMessage'

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'eBook AI Analyzer',
  description: 'AI-powered eBook analysis tool',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <DevToolsMessage />
        {children}
      </body>
    </html>
  );
} 