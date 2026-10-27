import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Shell } from "@/components/layout/Shell"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import Home from "@/pages/Home"
import DesignSystem from "@/pages/DesignSystem"
import NamesPage from "@/pages/NamesPage"
import Lookup from "@/pages/Lookup"
import NotFound from "@/pages/NotFound"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell navRight={<ConnectButton />} />}>
          <Route index element={<Home />} />
          {import.meta.env.DEV ? <Route path="design" element={<DesignSystem />} /> : null}
          <Route path="names" element={<NamesPage />} />
          <Route path=":name" element={<Lookup />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
