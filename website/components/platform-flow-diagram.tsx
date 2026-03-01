"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

// ── Data ────────────────────────────────────────────────────────

const platforms = [
  { name: "WhatsApp", icon: "/platforms/whatsapp.png" },
  { name: "Instagram", icon: "/platforms/instagram.png" },
  { name: "Telegram", icon: "/platforms/telegram.png" },
  { name: "Discord", icon: "/platforms/discord.png" },
  { name: "LinkedIn", icon: "/platforms/linkedin.png" },
  { name: "X", icon: "/platforms/x.png" },
  { name: "iMessage", icon: "/platforms/imessage.png" },
  { name: "Signal", icon: "/platforms/signal.png" },
  { name: "Slack", icon: "/platforms/slack.png" },
  { name: "Messenger", icon: "/platforms/messenger.png" },
]

const outputs = [
  { label: "Draft Replies", sub: "Sound like you" },
  { label: "Who They Are", sub: "Fan, lead, or VIP" },
  { label: "Priority Inbox", sub: "Most important first" },
  { label: "Track Progress", sub: "Unread → Done" },
]

// ── Animated dot ────────────────────────────────────────────────

function Dot({ delay, pathId, dur = 2, color = "#000" }: { delay: number; pathId: string; dur?: number; color?: string }) {
  return (
    <circle r="2.5" fill={color}>
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`}>
        <mpath href={`#${pathId}`} />
      </animateMotion>
      <animate
        attributeName="opacity"
        values="0;0.5;0.5;0"
        dur={`${dur}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
      />
    </circle>
  )
}

// ── Main component ──────────────────────────────────────────────

export function PlatformFlowDiagram() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Layout — 3 columns
  const W = 880
  const H = 460

  const col1 = 55        // platforms (single column)
  const centerX = W / 2   // parrot
  const col3 = W - 70     // outputs

  const midY = H / 2

  // Platform positions — single column, tight spacing
  const platformSpacing = 40
  const platformTotalH = (platforms.length - 1) * platformSpacing
  const platformStartY = midY - platformTotalH / 2
  const platformPos = platforms.map((p, i) => ({
    ...p,
    x: col1,
    y: platformStartY + i * platformSpacing,
  }))

  // Output positions — vertical stack of 4, centered on midY
  const outputSpacing = 85
  const outputStartY = midY - ((outputs.length - 1) * outputSpacing) / 2
  const outputPos = outputs.map((o, i) => ({
    ...o,
    x: col3,
    y: outputStartY + i * outputSpacing,
  }))

  // Center circle radii
  const innerR = 64
  const midR = 80
  const outerR = 94

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          {/* Paths: platforms → center */}
          {platformPos.map((p, i) => (
            <path
              key={`p-path-${i}`}
              id={`p-path-${i}`}
              d={`M ${p.x + 14} ${p.y} C ${p.x + 130} ${p.y}, ${centerX - 160} ${midY}, ${centerX - outerR} ${midY}`}
              fill="none"
            />
          ))}
          {/* Paths: center → outputs */}
          {outputPos.map((o, i) => (
            <path
              key={`o-path-${i}`}
              id={`o-path-${i}`}
              d={`M ${centerX + outerR} ${midY} C ${centerX + 160} ${midY}, ${o.x - 130} ${o.y}, ${o.x - 54} ${o.y}`}
              fill="none"
            />
          ))}
        </defs>

        {/* ── Connection lines ── */}

        {/* Platforms → Center */}
        {platformPos.map((p, i) => (
          <path
            key={`p-line-${i}`}
            d={`M ${p.x + 14} ${p.y} C ${p.x + 130} ${p.y}, ${centerX - 160} ${midY}, ${centerX - outerR} ${midY}`}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="1"
          />
        ))}

        {/* Center → Outputs */}
        {outputPos.map((o, i) => (
          <path
            key={`o-line-${i}`}
            d={`M ${centerX + outerR} ${midY} C ${centerX + 160} ${midY}, ${o.x - 130} ${o.y}, ${o.x - 54} ${o.y}`}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="1"
          />
        ))}

        {/* ── Animated dots ── */}
        {mounted && (
          <>
            {platformPos.map((_, i) => (
              <Dot key={`pd-${i}`} delay={i * 0.28} pathId={`p-path-${i}`} dur={2.4} />
            ))}
            {outputPos.map((_, i) => (
              <Dot key={`od-${i}`} delay={i * 0.35 + 0.4} pathId={`o-path-${i}`} dur={2} color="#71717a" />
            ))}
          </>
        )}

        {/* ── Column labels ── */}
        <text x={col1} y={24} textAnchor="middle" className="text-[10px] font-semibold fill-zinc-300 uppercase tracking-widest">
          Your DMs
        </text>
        <text x={centerX} y={24} textAnchor="middle" className="text-[10px] font-semibold fill-zinc-300 uppercase tracking-widest">
          Parrot
        </text>
        <text x={col3} y={24} textAnchor="middle" className="text-[10px] font-semibold fill-zinc-300 uppercase tracking-widest">
          What you get
        </text>

        {/* ── Platform icons — single column ── */}
        {platformPos.map((p, i) => (
          <g key={`platform-${i}`}>
            <foreignObject
              x={p.x - 12}
              y={p.y - 12}
              width="24"
              height="24"
              className={mounted ? "opacity-100" : "opacity-0"}
              style={{ transition: `opacity 0.4s ease ${i * 0.05}s` }}
            >
              <Image src={p.icon} alt={p.name} width={24} height={24} className="w-6 h-6 rounded-md object-cover" />
            </foreignObject>
          </g>
        ))}

        {/* ── Center node — Parrot ── */}
        <g className={mounted ? "opacity-100" : "opacity-0"} style={{ transition: "opacity 0.5s ease 0.3s" }}>
          {/* Outer rings */}
          <circle cx={centerX} cy={midY} r={outerR} fill="none" stroke="#f4f4f5" strokeWidth="1" />
          <circle cx={centerX} cy={midY} r={midR} fill="none" stroke="#e4e4e7" strokeWidth="1" />
          {/* Main circle */}
          <circle cx={centerX} cy={midY} r={innerR} fill="#fafafa" stroke="#e4e4e7" strokeWidth="1.5" />
          {/* Parrot logo */}
          <foreignObject x={centerX - 20} y={midY - 30} width="40" height="40">
            <div className="w-10 h-10 rounded-xl overflow-hidden">
              <Image src="/sidequests/parrot/logo.png" alt="Parrot" width={40} height={40} className="w-full h-full object-cover" />
            </div>
          </foreignObject>
          {/* Sublabel */}
          <text x={centerX} y={midY + 26} textAnchor="middle" className="text-[10px] fill-zinc-400">
            reads · learns · drafts
          </text>
        </g>

        {/* ── Descriptive text above/below center ── */}
        <text x={centerX} y={midY - outerR - 14} textAnchor="middle" className="text-[9px] fill-zinc-300">
          Extracts contacts, facts, relationships
        </text>
        <text x={centerX} y={midY + outerR + 22} textAnchor="middle" className="text-[9px] fill-zinc-300">
          Learns your voice, tone, and emoji habits
        </text>

        {/* ── Output nodes ── */}
        {outputPos.map((o, i) => (
          <g
            key={`output-${i}`}
            className={mounted ? "opacity-100" : "opacity-0"}
            style={{ transition: `opacity 0.4s ease ${0.7 + i * 0.1}s` }}
          >
            <rect
              x={o.x - 52}
              y={o.y - 26}
              width="104"
              height="52"
              rx="12"
              fill="#fafafa"
              stroke="#e4e4e7"
              strokeWidth="1.5"
            />
            <text x={o.x} y={o.y - 4} textAnchor="middle" className="text-[11px] font-semibold fill-zinc-700">
              {o.label}
            </text>
            <text x={o.x} y={o.y + 12} textAnchor="middle" className="text-[9px] fill-zinc-400">
              {o.sub}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
