import { createConfig, http } from "wagmi"
import { arbitrum, base, mainnet, optimism, sepolia } from "wagmi/chains"
import { coinbaseWallet, injected, safe, walletConnect } from "wagmi/connectors"

const env = import.meta.env as Record<string, string | undefined>
const projectId = env.VITE_WALLETCONNECT_PROJECT_ID ?? "6191fb10b1dcb3d4f3c12d53c6af9e0e"
const rpc = (id: number) => http(env[`VITE_RPC_URL_${id}`])

export const wagmiConfig = createConfig({
  chains: [mainnet, base, optimism, arbitrum, sepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "records.xyz", appLogoUrl: "https://records.xyz/favicon.svg" }),
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: { name: "records.xyz", description: "put your accounts on the record", url: "https://records.xyz", icons: ["https://records.xyz/favicon.svg"] },
    }),
    safe(),
  ],
  transports: {
    [mainnet.id]: rpc(mainnet.id),
    [base.id]: rpc(base.id),
    [optimism.id]: rpc(optimism.id),
    [arbitrum.id]: rpc(arbitrum.id),
    [sepolia.id]: rpc(sepolia.id),
  },
})

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig
  }
}

export type SupportedChainId = (typeof wagmiConfig)["chains"][number]["id"]
/** Narrow a runtime chain id to the ids wagmi is configured with. */
export const asChainId = (id: number) => id as SupportedChainId
