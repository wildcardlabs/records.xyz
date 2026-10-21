import { Link } from "react-router-dom"
import { Wrap } from "@/components/wrap/Section"

const cols: { h: string; links: { label: string; href: string; ext?: boolean }[] }[] = [
  { h: "product", links: [{ label: "records", href: "/" }, { label: "design system", href: "/design" }] },
  { h: "standard", links: [{ label: "ensip-28 · owned accounts", href: "https://docs.ens.domains/ensip/28/", ext: true }, { label: "ensip-24 · data records", href: "https://docs.ens.domains/ensip/24/", ext: true }] },
  { h: "company", links: [{ label: "wildcard labs", href: "https://wildcardlabs.xyz", ext: true }, { label: "@records_xyz", href: "https://x.com/records_xyz", ext: true }] },
  { h: "source", links: [{ label: "github", href: "https://github.com/wildcardlabs/records.xyz", ext: true }, { label: "mit license", href: "https://github.com/wildcardlabs/records.xyz/blob/main/LICENSE", ext: true }] },
]

function Footer() {
  return (
    <footer className="mt-auto bg-paper">
      <div className="rule" />
      <Wrap className="grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        {cols.map((c) => (
          <div key={c.h}>
            <div className="t-caption lowercase tracking-normal">{c.h}</div>
            <ul className="mt-3 space-y-1.5">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.ext ? (
                    <a className="link-blue text-[12px] text-ink-muted" href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ) : (
                    <Link className="link-blue text-[12px] text-ink-muted" to={l.href}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Wrap>
      <div className="rule" />
      <Wrap className="py-5 text-[11px] text-ink-dim">All Rights Reserved © {new Date().getFullYear()} records.xyz</Wrap>
    </footer>
  )
}

export { Footer }
