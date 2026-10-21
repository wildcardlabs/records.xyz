import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-none border border-line bg-paper px-3 py-1 font-mono text-[12.5px] font-medium text-ink transition-[border-color,background-color] duration-150 outline-none placeholder:text-ink-dim focus-visible:border-blue disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-err file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12px] file:font-semibold file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
