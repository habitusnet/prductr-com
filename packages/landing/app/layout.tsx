import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'prductr - Orchestration for Multi-Agent Development',
  description: 'Multi-LLM orchestration platform with Conductor, Lisa rescue agent, and Carlos roadmap generation.',
  keywords: ['orchestration', 'multi-agent', 'LLM', 'AI', 'conductor', 'automation'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Cloudflare Web Analytics */}
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "72c4f9d78a18479da134fa0e1869e036"}'
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
