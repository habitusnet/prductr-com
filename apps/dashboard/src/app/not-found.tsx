export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        404
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Page not found</p>
      <a
        href="/"
        className="px-4 py-2 bg-conductor-600 text-white rounded-lg hover:bg-conductor-700 transition-colors"
      >
        Go home
      </a>
    </div>
  );
}
