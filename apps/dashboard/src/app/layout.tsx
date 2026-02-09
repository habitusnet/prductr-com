import type { Metadata } from "next";
import "./globals.css";
import "@neondatabase/auth/ui/css";
import { Providers } from "./providers";
import { UserMenu } from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "Conductor Dashboard",
  description: "Multi-LLM orchestration dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Providers>
          <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <span className="text-xl font-bold text-conductor-600">
                    Conductor
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <a
                    href="/"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/tasks"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Tasks
                  </a>
                  <a
                    href="/agents"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Agents
                  </a>
                  <a
                    href="/costs"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Costs
                  </a>
                  <a
                    href="/sandboxes"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Sandboxes
                  </a>
                  <a
                    href="/secrets"
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Secrets
                  </a>
                  <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-1" />
                  <UserMenu />
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
