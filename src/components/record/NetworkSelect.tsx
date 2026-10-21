import { RECORDS_CHAINS } from "@/lib/ens/chains"

/** Which chain the name's records are read from (mainnet for production, sepolia for testing). */
function NetworkSelect({ value, onChange }: { value: number; onChange: (chainId: number) => void }) {
  return (
    <label className="inline-flex items-center gap-2 font-mono text-[11px] text-ink-dim">
      network
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 border border-line bg-paper px-2 font-mono text-[11px] font-semibold lowercase text-ink outline-none focus-visible:border-blue"
      >
        {RECORDS_CHAINS.map((c) => (
          <option key={c.chain.id} value={c.chain.id}>{c.label}</option>
        ))}
      </select>
    </label>
  )
}

export { NetworkSelect }
