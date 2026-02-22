import { ProjectCard } from "./project-card"

const projects = [
  {
    title: "The Space X Spacesuit",
    slug: "spacex-spacesuit",
    imageQuery: "SpaceX white spacesuit astronaut",
  },
  {
    title: "James Turell for Guggenheim",
    slug: "james-turell-guggenheim",
    imageQuery: "James Turrell light installation Guggenheim",
  },
  {
    title: "The Atollo Lamp",
    slug: "atollo-lamp",
    imageQuery: "Atollo lamp Vico Magistretti design",
  },
  {
    title: "The infinite machine P1",
    slug: "infinite-machine-p1",
    imageQuery: "Infinite Machine P1 electric motorcycle",
  },
  {
    title: "Juergen Greubel for Braun ・ Lectron Hobby Set Radio",
    slug: "braun-lectron",
    imageQuery: "Braun Lectron hobby set vintage electronics",
  },
  {
    title: "jonny ive for apple ・iMac G4",
    slug: "imac-g4",
    imageQuery: "Apple iMac G4 sunflower computer",
  },
  {
    title: "The RIMOWA × LA MARZOCCO COLLAB",
    slug: "rimowa-marzocco",
    imageQuery: "Rimowa La Marzocco collaboration coffee",
  },
  {
    title: "The ALD Porsche collab",
    slug: "ald-porsche",
    imageQuery: "Aime Leon Dore Porsche collaboration car",
  },
  {
    title: "The N26 Transparent Card",
    slug: "n26-card",
    imageQuery: "N26 transparent bank card design",
  },
  {
    title: "The Wassily Chair",
    slug: "wassily-chair",
    imageQuery: "Wassily Chair Marcel Breuer Bauhaus",
  },
  {
    title: "La Fabrica from Ricardo Bofill",
    slug: "la-fabrica",
    imageQuery: "La Fabrica Ricardo Bofill architecture Barcelona",
  },
  {
    title: "The Blloc Packaging",
    slug: "blloc-packaging",
    imageQuery: "Blloc minimalist black phone packaging",
  },
  {
    title: "The Nothing phone",
    slug: "nothing-phone",
    imageQuery: "Nothing Phone transparent back glyph interface",
  },
  {
    title: "Aus Taylor for Ye ・ Vultures Listening Experience in Haiku",
    slug: "vultures-haiku",
    imageQuery: "Vultures album listening experience dark minimal",
  },
  {
    title: "The Kith BMW Collab",
    slug: "kith-bmw",
    imageQuery: "Kith BMW collaboration car design",
  },
  {
    title: "Sony Walkman TPS-L2 by Masaru Ibuka",
    slug: "sony-walkman",
    imageQuery: "Sony Walkman TPS-L2 vintage portable cassette player",
  },
  {
    title: "Peter Yee for oakley・OVERTHETOP",
    slug: "oakley-overthetop",
    imageQuery: "Oakley Over The Top sunglasses futuristic design",
  },
  {
    title: "Virgil Abloh for 180 the strand・reverb",
    slug: "virgil-abloh-reverb",
    imageQuery: "Virgil Abloh 180 strand exhibition installation",
  },
]

export function ProjectGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {projects.map((project) => (
        <ProjectCard key={project.slug} {...project} />
      ))}
    </div>
  )
}
