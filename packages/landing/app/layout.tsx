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
      <body className="antialiased">{children}</body>
    </html>
  );
}
