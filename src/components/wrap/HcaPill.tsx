import type { Address } from "viem"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { shortAddr } from "@/lib/format"

/** marks a role holder as the smart account the ENS App runs for `owner` */
function HcaPill({ owner }: { owner: Address }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Badge variant="pill" className="text-ink-muted">ENS App</Badge>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-[11px] lowercase">smart account used by the ENS App for {shortAddr(owner, 4)}</TooltipContent>
    </Tooltip>
  )
}

export { HcaPill }
