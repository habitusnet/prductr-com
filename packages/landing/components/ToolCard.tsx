import Link from 'next/link';

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  href: string;
  features: string[];
}

export function ToolCard({ icon, title, description, href, features }: ToolCardProps) {
  return (
    <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-2xl transition-shadow border border-gray-100 flex flex-col">
      <div className="text-5xl mb-4">{icon}</div>

      <h3 className="text-2xl font-bold mb-3">{title}</h3>

      <p className="text-gray-600 mb-6 flex-grow">
        {description}
      </p>

      <ul className="space-y-2 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start text-sm text-gray-700">
            <span className="text-primary mr-2">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        View on GitHub →
      </Link>
    </div>
  );
}
