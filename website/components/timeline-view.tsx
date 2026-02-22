import Link from "next/link"

const timelineProjects = [
  {
    title: "The Space X Spacesuit",
    slug: "spacex-spacesuit",
  },
  {
    title: "James Turell for Guggenheim",
    slug: "james-turell-guggenheim",
  },
  {
    title: "The Atollo Lamp",
    slug: "atollo-lamp",
  },
  {
    title: "The infinite machine P1",
    slug: "infinite-machine-p1",
  },
  {
    title: "Juergen Greubel for Braun ・ Lectron Hobby Set Radio",
    slug: "braun-lectron-radio",
  },
  {
    title: "jonny ive for apple ・iMac G4",
    slug: "apple-imac-g4",
  },
  {
    title: "The RIMOWA × LA MARZOCCO COLLAB",
    slug: "rimowa-marzocco",
  },
  {
    title: "The ALD Porsche collab",
    slug: "ald-porsche",
  },
  {
    title: "The N26 Transparent Card",
    slug: "n26-card",
  },
  {
    title: "The Wassily Chair",
    slug: "wassily-chair",
  },
  {
    title: "La Fabrica from Ricardo Bofill",
    slug: "la-fabrica",
  },
  {
    title: "The Blloc Packaging",
    slug: "blloc-packaging",
  },
  {
    title: "The Nothing phone",
    slug: "nothing-phone",
  },
  {
    title: "Aus Taylor for Ye ・ Vultures Listening Experience in Haiku",
    slug: "vultures-haiku",
  },
  {
    title: "The Kith BMW Collab",
    slug: "kith-bmw",
  },
  {
    title: "Sony Walkman TPS-L2 by Masaru Ibuka",
    slug: "sony-walkman",
  },
  {
    title: "Peter Yee for oakley・OVERTHETOP",
    slug: "oakley-overthetop",
  },
  {
    title: "Virgil Abloh for 180 the strand・reverb",
    slug: "virgil-abloh-reverb",
  },
]

export function TimelineView() {
  return (
    <div className="space-y-1">
      {timelineProjects.map((project, index) => (
        <Link
          key={project.slug}
          href={`/project/${project.slug}`}
          className="block py-3 px-4 hover:bg-muted/50 transition-colors rounded-sm group"
        >
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-muted-foreground font-mono min-w-[2rem]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="text-lg font-light tracking-tight group-hover:text-foreground/80 transition-colors">
              {project.title}
            </h2>
          </div>
        </Link>
      ))}
    </div>
  )
}
