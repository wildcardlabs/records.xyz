import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

/** Lowercase mono tabs with a 1px blue underline on the active tab. */
function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-4 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex w-fit items-end gap-5 border-b border-line", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex items-center gap-1.5 border-b border-transparent px-0.5 pb-2 font-mono text-[12px] font-semibold lowercase text-ink-muted transition-colors duration-150 outline-none hover:text-blue focus-visible:text-blue data-active:border-blue data-active:text-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
