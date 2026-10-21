import { NavLink, Link } from "react-router-dom"
import { Logo } from "@/components/wrap/Logo"
import { Wrap } from "@/components/wrap/Section"

const links = [{ to: "/", label: "home" }, ...(import.meta.env.DEV ? [{ to: "/design", label: "design" }] : [])]

/** 62px white nav: pixel logo, lowercase links with a blue underline on hover, closed by a dotted rule. */
function Nav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="relative z-20 bg-paper">
      <Wrap className="flex h-[62px] items-center gap-6">
        <Link to="/" className="link-blue flex items-center gap-2 text-ink" aria-label="records.xyz home">
          <Logo />
          <span className="font-mono text-[13px] font-semibold lowercase">records.xyz</span>
        </Link>
        <nav className="hidden items-center gap-5 sm:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className="nav-link">
              {l.label}
            </NavLink>
          ))}
          <a className="nav-link" href="https://docs.ens.domains/ensip/28/" target="_blank" rel="noreferrer">
            ensip-28 ↗
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </Wrap>
      <div className="rule-dotted" />
    </header>
  )
}

export { Nav }
