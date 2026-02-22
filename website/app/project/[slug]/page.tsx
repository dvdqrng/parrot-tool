import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

const projectDetails: Record<string, { title: string; description: string; imageQuery: string }> = {
  "spacex-spacesuit": {
    title: "SpaceX Spacesuit",
    description:
      "A revolutionary design merging functionality with aesthetics for the next generation of space exploration.",
    imageQuery: "SpaceX white spacesuit astronaut",
  },
  "james-turrell-guggenheim": {
    title: "James Turrell for Guggenheim",
    description: "An immersive light installation that transforms space through perception and color.",
    imageQuery: "James Turrell light installation Guggenheim",
  },
  "atollo-lamp": {
    title: "Atollo Lamp",
    description: "Vico Magistretti's iconic lamp design that became a symbol of Italian design excellence.",
    imageQuery: "Atollo lamp Vico Magistretti design",
  },
  "apple-imac-g4": {
    title: "Apple iMac G4",
    description: 'The iconic "sunflower" iMac that revolutionized desktop computer design with its floating display.',
    imageQuery: "Apple iMac G4 sunflower computer",
  },
  "nothing-phone-1": {
    title: "Nothing Phone (1)",
    description: "Transparent design language with innovative Glyph interface lighting system.",
    imageQuery: "Nothing Phone transparent back glyph interface",
  },
  "braun-sk-4": {
    title: "Braun SK 4",
    description: "Dieter Rams' iconic radio-phonograph combination, known as 'Snow White's Coffin'.",
    imageQuery: "Braun SK 4 radio phonograph Dieter Rams",
  },
  "sony-walkman-tps-l2": {
    title: "Sony Walkman TPS-L2",
    description: "The device that revolutionized personal music consumption and created portable audio culture.",
    imageQuery: "Sony Walkman TPS-L2 vintage portable cassette player",
  },
  "dieter-rams-606": {
    title: "Dieter Rams 606 Universal Shelving System",
    description: "Modular shelving system that epitomizes Rams' 'less but better' design philosophy.",
    imageQuery: "Dieter Rams 606 shelving system Vitsoe",
  },
  "eames-lounge-chair": {
    title: "Eames Lounge Chair",
    description: "Charles and Ray Eames' iconic chair combining comfort, style, and innovative production techniques.",
    imageQuery: "Eames Lounge Chair and Ottoman leather walnut",
  },
  "helvetica-typeface": {
    title: "Helvetica Typeface",
    description: "Max Miedinger's neutral sans-serif typeface that became the world's most popular font.",
    imageQuery: "Helvetica typeface typography specimen",
  },
  "porsche-911": {
    title: "Porsche 911",
    description:
      "Ferdinand Porsche's timeless sports car design that has evolved while maintaining its iconic silhouette.",
    imageQuery: "Porsche 911 classic sports car",
  },
  "boeing-747": {
    title: "Boeing 747",
    description: "Joe Sutter's revolutionary wide-body aircraft that democratized air travel worldwide.",
    imageQuery: "Boeing 747 jumbo jet airplane",
  },
  "google-material-design": {
    title: "Google Material Design",
    description: "A comprehensive design language combining classic principles with innovation and technology.",
    imageQuery: "Google Material Design interface cards shadows",
  },
  "leica-m3": {
    title: "Leica M3",
    description: "The rangefinder camera that set the standard for precision photography equipment.",
    imageQuery: "Leica M3 vintage rangefinder camera",
  },
  concorde: {
    title: "Concorde",
    description: "The supersonic passenger airliner that represented the pinnacle of aviation design and engineering.",
    imageQuery: "Concorde supersonic jet airplane",
  },
  "bauhaus-dessau": {
    title: "Bauhaus Dessau",
    description: "Walter Gropius' architectural masterpiece that housed the influential Bauhaus school.",
    imageQuery: "Bauhaus Dessau building architecture Germany",
  },
  "nasa-apollo-guidance-computer": {
    title: "NASA Apollo Guidance Computer",
    description: "The pioneering computer that guided astronauts to the moon and back.",
    imageQuery: "Apollo Guidance Computer DSKY NASA",
  },
  "swiss-army-knife": {
    title: "Swiss Army Knife",
    description: "Karl Elsener's multi-tool that became an icon of Swiss precision and functionality.",
    imageQuery: "Swiss Army Knife Victorinox red multi tool",
  },
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = projectDetails[slug]

  if (!project) {
    notFound()
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8 md:py-16">
        <Link href="/" className="inline-block text-zinc-500 hover:text-zinc-400 transition-colors mb-12 text-lg">
          ← back
        </Link>

        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-5xl mb-6 md:mb-8 text-balance">{project.title}</h1>

          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-zinc-900 mb-8 md:mb-12">
            <Image
              src={`/.jpg?height=1000&width=1600&query=${encodeURIComponent(project.imageQuery)}`}
              alt={project.title}
              fill
              className="object-cover"
              priority
            />
          </div>

          <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">{project.description}</p>
        </div>
      </div>
    </main>
  )
}

export async function generateStaticParams() {
  return Object.keys(projectDetails).map((slug) => ({
    slug,
  }))
}
