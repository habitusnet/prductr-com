import Link from 'next/link';
import { ToolCard } from '../components/ToolCard';
import { Navigation } from '../components/Navigation';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          <span className="gradient-text">Orchestration</span>
          <br />
          for Multi-Agent Development
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12">
          A suite of tools to coordinate multiple LLM agents, rescue abandoned projects,
          and generate product roadmaps—all working together seamlessly.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="#tools"
            className="px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Explore Tools
          </Link>
          <Link
            href="https://github.com/habitusnet/conductor"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-200 shadow-md hover:shadow-lg"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-bold text-center mb-4">
          Three Tools, One Ecosystem
        </h2>
        <p className="text-xl text-gray-600 text-center mb-16 max-w-2xl mx-auto">
          Each tool solves a specific challenge in modern AI-driven development
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <ToolCard
            icon="🎯"
            title="Conductor"
            description="Multi-tenant LLM orchestration platform. Coordinate Claude, GPT, Gemini, and custom agents on shared codebases with task queuing, file locking, and cost tracking."
            href="https://github.com/habitusnet/conductor"
            features={[
              "21 MCP tools for coordination",
              "Multi-tenant with access control",
              "Cloudflare D1 + Vercel deployment",
              "1,374+ passing tests"
            ]}
          />

          <ToolCard
            icon="🏛️"
            title="Lisa"
            description="Archaeological rescue agent for abandoned projects. Reconstructs lost context through git archaeology, timeline analysis, and mission extraction to revive dead codebases."
            href="https://github.com/habitusnet/conductor"
            features={[
              "Git timeline reconstruction",
              "Semantic memory extraction",
              "Bead & convoy work structuring",
              "Multi-project reconciliation"
            ]}
          />

          <ToolCard
            icon="📋"
            title="Carlos"
            description="AI-powered product roadmap generation. Scans docs, PRDs, and legacy tasks to create comprehensive scopecraft roadmaps with epics, stories, and PMF metrics."
            href="https://github.com/habitusnet/conductor"
            features={[
              "Auto-generate 6 scopecraft files",
              "Vision & stage definition",
              "Risk & dependency mapping",
              "PMF validation framework"
            ]}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-12 text-white">
          <h2 className="text-4xl font-bold mb-4">
            Ready to orchestrate your development?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Start with Conductor, rescue projects with Lisa, or plan roadmaps with Carlos
          </p>
          <Link
            href="https://github.com/habitusnet/conductor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 bg-white text-primary rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
          >
            Get Started on GitHub
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>Built with ❤️ for the multi-agent development community</p>
          <p className="mt-2">
            <Link href="https://github.com/habitusnet" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              GitHub
            </Link>
            {' · '}
            <Link href="https://conductor.prductr.com" className="hover:text-primary transition-colors">
              Conductor Dashboard
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
