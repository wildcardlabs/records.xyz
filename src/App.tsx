import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Shell } from "@/components/layout/Shell"
import Home from "@/pages/Home"
import DesignSystem from "@/pages/DesignSystem"
import NotFound from "@/pages/NotFound"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="design" element={<DesignSystem />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
