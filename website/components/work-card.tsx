import Image from "next/image"

interface WorkCardProps {
  title: string
  description?: string
  imageSrc: string
}

export function WorkCard({ title, description, imageSrc }: WorkCardProps) {
  return (
    <div className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted mb-3">
        <Image
          src={imageSrc}
          alt={title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <h3 className="text-sm md:text-base font-light text-foreground group-hover:text-muted-foreground transition-colors">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-zinc-500 mt-1">{description}</p>
      )}
    </div>
  )
}
