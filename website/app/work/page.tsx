import Link from "next/link"
import { WorkGrid } from "@/components/work-grid"

export default function WorkPage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <Link href="/" className="inline-block text-zinc-500 hover:text-zinc-400 transition-colors mb-12 text-lg">
          ← back
        </Link>

        <h1 className="text-4xl md:text-5xl mb-12">Work</h1>

        <p className="text-zinc-400 text-lg leading-relaxed mb-12 max-w-2xl">
          A selection of visual work samples showcasing design explorations, brand identities, and digital experiences.
        </p>

        <WorkGrid />
      </div>
    </main>
  )
}
