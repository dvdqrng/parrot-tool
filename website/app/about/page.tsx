import Link from "next/link"

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Link href="/" className="inline-block text-zinc-500 hover:text-zinc-400 transition-colors mb-12 text-lg">
          ← back
        </Link>

        <h1 className="text-4xl md:text-5xl mb-12">About</h1>

        <div className="space-y-6 text-zinc-400 text-lg leading-relaxed">
          <p>
            David Quiring is a designer with a background in psychology and psychoanalysis, bringing a unique
            perspective to design thinking and problem-solving.
          </p>

          <p>
            Currently building intelligent email at lovemail.so, David has previously led design teams at Klar (modern
            banking in Mexico) and N26 (redesigning banking), combining technical execution with deep user
            understanding.
          </p>

          <p>
            His curated collection of iconic designs reflects an appreciation for timeless aesthetics, innovative
            thinking, and the intersection of form and function across disciplines.
          </p>
        </div>
      </div>
    </main>
  )
}
