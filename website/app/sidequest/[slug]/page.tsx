import { notFound } from "next/navigation"
import Image from "next/image"
import { TopNav } from "@/components/top-nav"
// import { DownloadButton } from "@/components/download-button"
import { getSidequest, getSidequestSlugs, getAllSidequests } from "@/lib/sidequests"
import { ParrotKanbanDemo } from "@/components/parrot-kanban-demo"

function ActionIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    desktop: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
    mail: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    phone: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    apple: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
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
    shield: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    cpu: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    mic: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    plus: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    chart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    globe: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    kanban: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    robot: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    heart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    inbox: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
  }
  return <>{icons[type] || icons.sparkles}</>
}

function PlaceholderMockup({ className = "" }: { className?: string }) {
  return (
    <div className={`aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl border border-zinc-200 shadow-lg ${className}`} />
  )
}

export default async function SidequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sidequest = getSidequest(slug)

  if (!sidequest) {
    notFound()
  }

  const allSidequests = getAllSidequests()

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
        <TopNav
          tabs={["timeline", "sidequests"]}
          currentPage={sidequest.title.toLowerCase()}
          sidequests={allSidequests.map(({ slug, sidequest }) => ({
            name: sidequest.title,
            slug,
          }))}
        />
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 max-w-6xl pt-12 pb-8">
        {/* App logo + Platform pill */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm overflow-hidden relative">
            <Image src={sidequest.logo} alt={sidequest.title} fill className="object-cover" />
          </div>
          <div className="flex items-center gap-2">
            <ActionIcon type={sidequest.actions?.primary?.icon || "desktop"} />
            <span className="text-sm opacity-50">{sidequest.actions?.primary?.label}</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-4 max-w-3xl">
          {sidequest.tagline}
        </h1>

        {/* Subheadline */}
        {sidequest.subtagline && (
          <p className="text-xl opacity-40 max-w-2xl mb-8">
            {sidequest.subtagline}
          </p>
        )}

        {/* CTA */}
        <div className="flex flex-wrap items-center gap-4">
          {sidequest.actions?.secondary && (
            <a
              href={sidequest.actions.secondary.href}
              className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-3 hover:bg-zinc-800 transition-colors"
            >
              {sidequest.actions.secondary.icon && <ActionIcon type={sidequest.actions.secondary.icon} />}
              <span>{sidequest.actions.secondary.label}</span>
            </a>
          )}
        </div>
      </section>

      {/* Hero Screenshot / Interactive Demo */}
      <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-12">
        {slug === "parrot" ? (
          /* Parrot: render live kanban demo */
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 bg-zinc-50 p-4">
            <ParrotKanbanDemo variant="full" maxCards={6} />
          </div>
        ) : sidequest.screenshots[0] ? (
          sidequest.platform === "ios" ? (
            /* Mobile app: phone-sized screenshots, constrained to viewport height */
            <div className="flex justify-center items-center gap-4 sm:gap-6">
              {sidequest.screenshots.map((src, index) => (
                <div key={index} className="rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-200 max-h-[85vh] w-auto">
                  <Image
                    src={src}
                    alt={`${sidequest.title} screenshot ${index + 1}`}
                    width={390}
                    height={844}
                    className="h-full max-h-[85vh] w-auto object-contain"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Desktop app: full-width screenshot */
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-zinc-200">
              <Image
                src={sidequest.screenshots[0]}
                alt={sidequest.title}
                width={1920}
                height={1080}
                className="w-full h-auto"
              />
            </div>
          )
        ) : (
          <PlaceholderMockup />
        )}
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
                  <FeatureIcon type={["inbox", "sparkles", "users"][index] || "sparkles"} className="w-5 h-5 opacity-60" />
                </div>
                <h3 className="font-semibold mb-2">{prop.title}</h3>
                <p className="text-sm opacity-50 leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feature Sections */}
      {sidequest.featureSections && sidequest.featureSections.map((section, index) => (
        <section key={index} className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          {/* Label pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-xs mb-6">
            <FeatureIcon type={["mic", "sparkles", "inbox"][index] || "sparkles"} className="w-3.5 h-3.5" />
            <span>{["Voice AI", "Smart Tools", "Unified Inbox"][index] || "Feature"}</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight mb-4 max-w-2xl">
            {section.headline}
          </h2>

          {/* Description */}
          <p className="text-lg opacity-40 max-w-xl mb-12">
            {section.description}
          </p>

          {/* Mockup / Interactive Demo */}
          {section.demo ? (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-zinc-200 bg-zinc-50 p-4">
              <ParrotKanbanDemo variant={section.demo as "full" | "drafts-focus" | "platform-view" | "context-panel"} />
            </div>
          ) : section.image ? (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-zinc-200">
              <Image
                src={section.image}
                alt={section.headline}
                width={1200}
                height={800}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <PlaceholderMockup />
          )}
        </section>
      ))}

      {/* Audience / Use Cases Section */}
      {sidequest.audienceSections && sidequest.audienceSections.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 max-w-6xl py-20">
          {/* Label pill */}
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
                    <li key={pointIndex} className="text-sm opacity-50 leading-relaxed">
                      {point}
                    </li>
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
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm overflow-hidden relative">
              <Image src={sidequest.logo} alt={sidequest.title} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm opacity-40">{sidequest.title} &middot; {sidequest.status}</p>
            </div>
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
