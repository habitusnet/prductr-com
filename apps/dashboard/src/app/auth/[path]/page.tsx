/**
 * Neon Auth view pages (sign-in, sign-up, forgot-password, etc.)
 *
 * Uses the built-in AuthView component from @neondatabase/auth
 */

import { AuthView } from "@neondatabase/auth/react/ui";
import { authViewPaths } from "@neondatabase/auth/react/ui/server";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <AuthView pathname={path} />
      </div>
    </div>
  );
}
