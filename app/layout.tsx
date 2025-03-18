import React from 'react';
import { Inter } from 'next/font/google';
import './globals.css'; // Import the global CSS file with animations

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'eBook AI Analyzer',
  description: 'AI-powered eBook analysis tool',
};

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
      <body className={inter.className}>{children}</body>
    </html>
  );
} 