import { WorkCard } from "./work-card"

// Sample work items - replace with your actual work samples
const workItems = [
  {
    title: "Project One",
    description: "Visual design exploration",
    imageSrc: "/.jpg?height=800&width=640&query=minimal+design+portfolio+work",
  },
  {
    title: "Project Two",
    description: "Brand identity",
    imageSrc: "/.jpg?height=800&width=640&query=brand+identity+design+modern",
  },
  {
    title: "Project Three",
    description: "UI/UX design",
    imageSrc: "/.jpg?height=800&width=640&query=ui+ux+interface+design+clean",
  },
  {
    title: "Project Four",
    description: "Product design",
    imageSrc: "/.jpg?height=800&width=640&query=product+design+industrial+minimal",
  },
  {
    title: "Project Five",
    description: "Digital experience",
    imageSrc: "/.jpg?height=800&width=640&query=digital+experience+design+creative",
  },
  {
    title: "Project Six",
    description: "Art direction",
    imageSrc: "/.jpg?height=800&width=640&query=art+direction+photography+studio",
  },
]

export function WorkGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {workItems.map((item, index) => (
        <WorkCard key={index} {...item} />
      ))}
    </div>
  )
}
