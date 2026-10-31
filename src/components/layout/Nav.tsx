import { NavLink, Link } from "react-router-dom"
import { Menu } from "lucide-react"
import { useConnection } from "wagmi"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/wrap/Logo"
import { Wrap } from "@/components/wrap/Section"

const links = [{ to: "/", label: "home" }, ...(import.meta.env.DEV ? [{ to: "/design", label: "design" }] : [])]

/** 62px white nav: pixel logo, lowercase links with a blue underline on hover, closed by a dotted rule. */
function Nav({ right }: { right?: React.ReactNode }) {
  const { isConnected } = useConnection()
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
          {isConnected ? (
            <NavLink to="/account" className="nav-link">
              account
            </NavLink>
          ) : null}
          <NavLink to="/renew" className="nav-link">
            renew
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {right}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="sm:hidden" aria-label="menu" />}>
              <Menu className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono">
              <DropdownMenuItem render={<Link to="/" />}>home</DropdownMenuItem>
              {isConnected ? <DropdownMenuItem render={<Link to="/account" />}>account</DropdownMenuItem> : null}
              <DropdownMenuItem render={<Link to="/renew" />}>renew</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Wrap>
      <div className="rule-dotted" />
    </header>
  )
}

export { Nav }
