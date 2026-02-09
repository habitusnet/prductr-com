import Link from 'next/link';

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold gradient-text">
            prductr
          </Link>

          <div className="flex gap-6 items-center">
            <Link
              href="#tools"
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              Tools
            </Link>
            <Link
              href="https://github.com/habitusnet/conductor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-primary transition-colors font-medium"
            >
              GitHub
            </Link>
            <Link
              href="https://conductor.prductr.com"
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
