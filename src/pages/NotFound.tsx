import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Section, SectionHeader } from "@/components/wrap"

export default function NotFound() {
  return (
    <Section>
      <SectionHeader eyebrow="404" title="Nothing on the record here" lede="That page does not exist." />
      <Button variant="outline" render={<Link to="/" />}>back to records</Button>
    </Section>
  )
}
