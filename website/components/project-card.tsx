import Link from "next/link"
import Image from "next/image"

interface ProjectCardProps {
  title: string
  slug: string
  imageQuery: string
}

export function ProjectCard({ title, slug, imageQuery }: ProjectCardProps) {
  return (
    <Link href={`/project/${slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted mb-3">
        <Image
          src={`/.jpg?height=800&width=640&query=${encodeURIComponent(imageQuery)}`}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <h3 className="text-sm md:text-base font-light text-foreground group-hover:text-muted-foreground transition-colors">
        {title}
      </h3>
    </Link>
  )
}
