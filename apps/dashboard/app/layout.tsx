'use client'

import './globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  }))

  return (
    <html lang="en" data-theme="dark">
      <head>
        <title>Nior — Command Center</title>
        <meta name="description" content="Futuristic kill-switch command center for your web fleet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(15,15,15,0.95)',
                backdropFilter: 'blur(20px)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '13px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              },
              success: { iconTheme: { primary: '#34d399', secondary: '#000' } },
              error:   { iconTheme: { primary: '#FF2D55', secondary: '#000' } },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  )
}
