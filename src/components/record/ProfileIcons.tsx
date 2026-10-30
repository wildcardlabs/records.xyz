import { Box, Globe, Mail } from "lucide-react"
import { siDiscord, siFarcaster, siGithub, siIpfs, siReddit, siTelegram, siX } from "simple-icons"

type Brand = { path: string; title: string }

/** brand marks from simple-icons, drawn in the current text colour */
function Mark({ icon, className }: { icon: Brand; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={icon.title} className={className} fill="currentColor">
      <path d={icon.path} />
    </svg>
  )
}

const BRANDS: Record<string, Brand> = {
  "com.twitter": siX,
  "com.github": siGithub,
  "xyz.farcaster": siFarcaster,
  "org.telegram": siTelegram,
  "com.discord": siDiscord,
  "com.reddit": siReddit,
}

/** the icon for a social record key; falls back to a plain link mark */
function SocialIcon({ keyName, className = "size-3" }: { keyName: string; className?: string }) {
  const brand = BRANDS[keyName]
  if (brand) return <Mark icon={brand} className={className} />
  if (keyName === "com.linkedin")
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="LinkedIn" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    )
  if (keyName === "email") return <Mail className={className} aria-label="email" />
  return <Globe className={className} />
}

/** the icon for a content hash: the IPFS mark for ipfs:// and ipns://, a box for anything else */
function ContentIcon({ contenthash, className = "size-3" }: { contenthash: string; className?: string }) {
  if (/^ipfs:\/\/|^ipns:\/\//.test(contenthash)) return <Mark icon={siIpfs} className={className} />
  return <Box className={className} aria-label="content hash" />
}

export { SocialIcon, ContentIcon }
