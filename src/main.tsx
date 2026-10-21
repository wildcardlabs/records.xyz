import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { Toaster } from "@/components/ui/sonner"
import { wagmiConfig } from "@/lib/wagmi"
import App from "./App"
import "./index.css"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)
