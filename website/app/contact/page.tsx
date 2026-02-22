import Link from "next/link"

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link href="/" className="inline-block text-zinc-500 hover:text-zinc-400 transition-colors mb-12 text-lg">
          ← back
        </Link>

        <h1 className="text-4xl md:text-5xl mb-12">Contact</h1>

        <div className="space-y-6 text-zinc-400 text-lg leading-relaxed">
          <p>For inquiries about design work, collaborations, or general questions, please reach out via email.</p>

          <div className="pt-4">
            <a href="mailto:hello@davidquiring.co" className="text-white hover:text-zinc-400 transition-colors text-xl">
              hello@davidquiring.co
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
