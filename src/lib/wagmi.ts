import { createConfig, http } from "wagmi"
import { arbitrum, arbitrumSepolia, base, baseSepolia, mainnet, optimism, optimismSepolia, sepolia } from "wagmi/chains"
import { injected, walletConnect } from "wagmi/connectors"

const env = import.meta.env as Record<string, string | undefined>
/** WalletConnect needs a project id whose allowlist includes this site; without one the option is not offered. */
const projectId = env.VITE_WALLETCONNECT_PROJECT_ID?.trim()
const rpc = (id: number) => http(env[`VITE_RPC_URL_${id}`])
export const wagmiConfig = createConfig({
  chains: [mainnet, base, optimism, arbitrum, sepolia, baseSepolia, optimismSepolia, arbitrumSepolia],
  // browser wallets via EIP-6963 discovery (wagmi default) plus WalletConnect when a project id is set
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: { name: "records.xyz", description: "put your accounts on the record", url: "https://records.xyz", icons: ["https://records.xyz/favicon.svg"] },
          }),
        ]
      : []),
  ],
  transports: {
    [mainnet.id]: rpc(mainnet.id),
    [base.id]: rpc(base.id),
    [optimism.id]: rpc(optimism.id),
    [arbitrum.id]: rpc(arbitrum.id),
    [sepolia.id]: rpc(sepolia.id),
    [baseSepolia.id]: rpc(baseSepolia.id),
    [optimismSepolia.id]: rpc(optimismSepolia.id),
    [arbitrumSepolia.id]: rpc(arbitrumSepolia.id),
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
