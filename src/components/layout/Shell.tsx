import { Outlet } from "react-router-dom"
import { Nav } from "./Nav"
import { Footer } from "./Footer"

function Shell({ navRight }: { navRight?: React.ReactNode }) {
  return (
    <>
      <Nav right={navRight} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export { Shell }
