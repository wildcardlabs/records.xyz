import { useParams } from "react-router-dom"
import { getAddress, isAddress } from "viem"
import NamesPage from "./NamesPage"
import RecordPage from "./RecordPage"

/** `/alice.eth` is a record; `/0x…` is that wallet's names. */
export default function Lookup() {
  const { name = "" } = useParams()
  if (isAddress(name)) return <NamesPage address={getAddress(name)} />
  return <RecordPage />
}
