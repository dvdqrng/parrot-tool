import { notFound } from "next/navigation"
import fs from "fs"
import path from "path"
import { ParrotKanbanDemo } from "@/components/parrot-kanban-demo"

// ============================================
// Types (inline to keep self-contained)
// ============================================

type Feature = { icon: string; title: string; description: string }
type ValueProp = { title: string; description: string }
type FeatureSection = { headline: string; description: string; image?: string; demo?: string }
type AudienceSection = { title: string; points: string[] }
type Action = { icon: string; label: string; href: string }

type Sidequest = {
  title: string
  tagline: string
  subtagline?: string
  category: string
  date: string
  status: string
  logo: string
  platform: "ios" | "macos"
  screenshots: string[]
  pills: { icon: string; text: string }[]
  bigStatement?: string
  valueProps?: ValueProp[]
  audienceSections?: AudienceSection[]
  featureSections?: FeatureSection[]
  useCases?: string[]
  features: Feature[]
  closingCta?: { headline: string; subheadline: string }
  actions: { primary?: Action; secondary?: Action }
}

// ============================================
// Data loading
// ============================================

const sidequestsDir = path.join(process.cwd(), "content/sidequests")

function getSidequest(slug: string): Sidequest | null {
  const filePath = path.join(sidequestsDir, `${slug}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Sidequest
}

function getSidequestSlugs(): string[] {
  if (!fs.existsSync(sidequestsDir)) return []
  return fs.readdirSync(sidequestsDir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""))
}

// ============================================
// Icon components
// ============================================

function ActionIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    desktop: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  }
  return <>{icons[type] || icons.desktop}</>
}

function FeatureIcon({ type, className = "w-6 h-6" }: { type: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    sparkles: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    heart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    robot: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    inbox: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
    mic: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  }
  return <>{icons[type] || icons.sparkles}</>
}

// ============================================
// Page
// ============================================

export default async function SidequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sidequest = getSidequest(slug)

  if (!sidequest) {
    notFound()
  }

  const featureIcons = ["mic", "sparkles", "inbox"]
  const featureLabels = ["Voice AI", "Smart Tools", "Unified Inbox"]
  const valuePropIcons = ["inbox", "sparkles", "users"]

  return (
    <main className="min-h-screen">
      {/* Simple nav */}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
        <nav className="flex items-center gap-6">
          <span className="text-sm font-medium opacity-40">{sidequest.title}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 max-w-6xl pt-12 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sidequest.logo} alt={sidequest.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center gap-2">
            <ActionIcon type={sidequest.actions?.primary?.icon || "desktop"} />
            <span className="text-sm opacity-50">{sidequest.actions?.primary?.label}</span>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-4 max-w-3xl">
          {sidequest.tagline}
        </h1>

        {sidequest.subtagline && (
          <p className="text-xl opacity-40 max-w-2xl mb-8">
            {sidequest.subtagline}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {sidequest.actions?.secondary && (
            <a
              href={sidequest.actions.secondary.href}
              className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-3 hover:bg-zinc-800 transition-colors"
            >
              <ActionIcon type={sidequest.actions.secondary.icon} />
              <span>{sidequest.actions.secondary.label}</span>
            </a>
          )}
        </div>
      </section>

      {/* Hero — Interactive Kanban Demo */}
      <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-12">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 bg-zinc-50 p-4">
          <ParrotKanbanDemo variant="full" maxCards={6} />
        </div>
      </section>

      {/* Big bold statement */}
      {sidequest.bigStatement && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-tight max-w-4xl">
            {sidequest.bigStatement}
          </h2>
        </section>
      )}

      {/* Value Props Cards */}
      {sidequest.valueProps && sidequest.valueProps.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sidequest.valueProps.map((prop, index) => (
              <div key={index} className="bg-white border border-zinc-200 rounded-2xl p-6">
                <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center mb-16">
                  <FeatureIcon type={valuePropIcons[index] || "sparkles"} className="w-5 h-5 opacity-60" />
                </div>
                <h3 className="font-semibold mb-2">{prop.title}</h3>
                <p className="text-sm opacity-50 leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature Sections with Interactive Demos */}
      {sidequest.featureSections && sidequest.featureSections.map((section, index) => (
        <section key={index} className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-xs mb-6">
            <FeatureIcon type={featureIcons[index] || "sparkles"} className="w-3.5 h-3.5" />
            <span>{featureLabels[index] || "Feature"}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-4 max-w-2xl">
            {section.headline}
          </h2>

          <p className="text-lg opacity-40 max-w-xl mb-12">
            {section.description}
          </p>

          {section.demo ? (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-zinc-200 bg-zinc-50 p-4">
              <ParrotKanbanDemo variant={section.demo as "full" | "drafts-focus" | "platform-view" | "context-panel"} />
            </div>
          ) : (
            <div className="aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl border border-zinc-200 shadow-lg" />
          )}
        </section>
      ))}

      {/* Audience Sections */}
      {sidequest.audienceSections && sidequest.audienceSections.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-xs mb-6">
            <FeatureIcon type="users" className="w-3.5 h-3.5" />
            <span>Use cases</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Built for people who are drowning in DMs.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {sidequest.audienceSections.map((section, index) => (
              <div key={index} className="bg-zinc-100 rounded-2xl p-6 min-h-[200px] flex flex-col">
                <h3 className="font-semibold mb-4">{section.title}</h3>
                <ul className="space-y-2">
                  {section.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="text-sm opacity-50 leading-relaxed">{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features Grid */}
      {sidequest.features && sidequest.features.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sidequest.features.map((feature, index) => (
              <div key={index} className="bg-zinc-100 rounded-2xl p-6 min-h-[160px] flex flex-col">
                <div className="flex items-center gap-2 mb-auto">
                  <FeatureIcon type={feature.icon} className="w-4 h-4 opacity-40" />
                  <h3 className="font-semibold">{feature.title}</h3>
                </div>
                <p className="text-sm opacity-50 mt-6 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA */}
      {sidequest.closingCta && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4 max-w-3xl">
            {sidequest.closingCta.headline}
          </h2>
          <p className="text-lg opacity-40 max-w-xl mb-8">
            {sidequest.closingCta.subheadline}
          </p>
          {sidequest.actions?.secondary && (
            <a
              href={sidequest.actions.secondary.href}
              className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-3 hover:bg-zinc-800 transition-colors"
            >
              <ActionIcon type={sidequest.actions.secondary.icon} />
              <span>{sidequest.actions.secondary.label}</span>
            </a>
          )}
        </section>
      )}

      {/* Footer */}
      <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-12 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sidequest.logo} alt={sidequest.title} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm opacity-40">{sidequest.title} &middot; {sidequest.status}</p>
          </div>
          <p className="text-xs opacity-30">{sidequest.actions?.primary?.label}</p>
        </div>
      </section>
    </main>
  )
}

export async function generateStaticParams() {
  const slugs = getSidequestSlugs()
  return slugs.map((slug) => ({ slug }))
}
