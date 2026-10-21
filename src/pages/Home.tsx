import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Section, SectionHeader } from "@/components/wrap"

export default function Home() {
  return (
    <Section>
      <SectionHeader as="h1" eyebrow="records.xyz" title="Put your accounts on the record" lede="The app lands here next. The design system is ready to review." />
      <Button variant="accent" render={<Link to="/design" />}>open the design system</Button>
    </Section>
  )
}
