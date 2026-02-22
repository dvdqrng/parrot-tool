import fs from "fs"
import path from "path"

export type Feature = {
  icon: string
  title: string
  description: string
}

export type Pill = {
  icon: string
  text: string
}

export type Action = {
  icon: string
  label: string
  href: string
}

export type ValueProp = {
  title: string
  description: string
}

export type FeatureSection = {
  headline: string
  subheadline?: string
  description: string
  image?: string
  demo?: string // interactive demo variant (e.g., "full", "drafts-focus", "platform-view")
}

export type AudienceSection = {
  title: string
  points: string[]
}

export type UseCase = string

export type Sidequest = {
  title: string
  tagline: string
  subtagline?: string
  category: string
  date: string // YYYY-MM format
  status: string
  logo: string
  platform: "ios" | "macos"
  screenshots: string[]
  announcement?: string
  pills: Pill[]
  bigStatement?: string
  valueProps?: ValueProp[]
  audienceSections?: AudienceSection[]
  featureSections?: FeatureSection[]
  useCases?: UseCase[]
  features: Feature[]
  closingCta?: { headline: string; subheadline: string }
  actions: {
    primary?: Action
    secondary?: Action
  }
}

const sidequestsDirectory = path.join(process.cwd(), "content/sidequests")

export function getSidequestSlugs(): string[] {
  const files = fs.readdirSync(sidequestsDirectory)
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
}

export function getSidequest(slug: string): Sidequest | null {
  const filePath = path.join(sidequestsDirectory, `${slug}.json`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const fileContents = fs.readFileSync(filePath, "utf8")
  return JSON.parse(fileContents) as Sidequest
}

export function getAllSidequests(): { slug: string; sidequest: Sidequest }[] {
  const slugs = getSidequestSlugs()
  return slugs.map((slug) => ({
    slug,
    sidequest: getSidequest(slug)!,
  }))
}
