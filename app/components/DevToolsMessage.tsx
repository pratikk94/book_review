'use client';

import { useEffect } from 'react';

export default function DevToolsMessage() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '%cDownload the React DevTools for a better development experience: https://reactjs.org/link/react-devtools',
        'color: #61dafb; font-size: 14px;'
      );
    }
  }, []);

  return null;
} 