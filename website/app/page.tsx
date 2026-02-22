import { Suspense } from "react"
import { getAllSidequests } from "@/lib/sidequests"
import { HomePageContent } from "@/components/home-page-content"

const timelineData = [
  {
    years: "2022 - now",
    title: "building intelligent email",
    subtitle: "founder",
    link: "lovemail.so",
  },
  {
    years: "2019 - 2022",
    title: "bringing modern banking to mexico",
    subtitle: "vp design",
    link: "klar.mx",
  },
  {
    years: "2019 - 2022",
    title: "redesign banking",
    subtitle: "design lead",
    link: "n26.com",
  },
  {
    years: "2015 - 2017",
    title: "studying design",
    subtitle: "hfg-gmuend",
  },
  {
    years: "2012 - 2015",
    title: "practicing as a psychoanalyst",
  },
  {
    years: "2006 - 2012",
    title: "studying psychology",
  },
]

function formatDate(dateStr: string): string {
  const [year, month] = dateStr.split("-")
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

export default function HomePage() {
  const allSidequests = getAllSidequests()
  const sidequestsData = allSidequests
    .map(({ slug, sidequest }) => ({
      name: sidequest.title,
      tagline: sidequest.tagline,
      category: sidequest.category,
      status: sidequest.status,
      date: sidequest.date,
      dateFormatted: formatDate(sidequest.date),
      slug,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomePageContent
        timelineData={timelineData}
        sidequestsData={sidequestsData}
      />
    </Suspense>
  )
}
