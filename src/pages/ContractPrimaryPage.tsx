import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type Address,
  type Hex,
  concat,
  encodeFunctionData,
  isAddress,
  isAddressEqual,
  pad,
  zeroAddress,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import {
  useConnection,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AddressLink,
  Figure,
  Section,
  SectionHeader,
  StatusText,
} from "@/components/wrap";
import { primaryQueryKey, usePrimaryNames } from "@/hooks/usePrimaryNames";
import { publicClient } from "@/lib/ens/clients";
import { type PrimaryTarget, primaryTargets } from "@/lib/ens/primary";
import { shortAddr } from "@/lib/format";
import { asChainId } from "@/lib/wagmi";

/**
 * Set the ethereum primary name of a contract you own. The v1 ReverseRegistrar lets an
 * Ownable contract's owner name it (it calls `owner()` on the contract and compares it to the
 * sender), so no signature from the contract is needed: `setNameForAddr(addr, owner, resolver, name)`
 * claims `<addr>.addr.reverse` for `owner`, points it at `resolver` and writes the name there.
 * (The DefaultReverseRegistrar's `setNameForAddr` is controller-only, so there is no default here.)
 * When the owner is a Safe, a signer sends it through the Safe's `execTransaction` with a
 * pre-approved signature (v = 1, r = the sender), which is enough when the threshold is 1.
 */
const ownableAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;
const homeRegistrarAbi = [
  {
    type: "function",
    name: "defaultResolver",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "setNameForAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "addr", type: "address" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "name", type: "string" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;
const safeAbi = [
  {
    type: "function",
    name: "getOwners",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "getThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "execTransaction",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const targets = primaryTargets(mainnet.id);
const HOME = targets.find((t) => t.kind === "home")!;

type Checks = {
  owner: Address | null;
  forward: Address | null;
  resolver: Address;
  safe: { signers: Address[]; threshold: bigint } | null;
};

async function fetchChecks(contract: Address, name: string): Promise<Checks> {
  const client = publicClient(mainnet.id);
  const [owner, forward, resolver] = await Promise.all([
    client
      .readContract({
        address: contract,
        abi: ownableAbi,
        functionName: "owner",
      })
      .catch(() => null),
    name
      ? client.getEnsAddress({ name: normalize(name) }).catch(() => null)
      : Promise.resolve(null),
    client.readContract({
      address: HOME.registrar,
      abi: homeRegistrarAbi,
      functionName: "defaultResolver",
    }),
  ]);
  // an owner that is itself a Safe: who may sign for it
  let safe: Checks["safe"] = null;
  if (owner) {
    const [signers, threshold] = await Promise.all([
      client
        .readContract({
          address: owner,
          abi: safeAbi,
          functionName: "getOwners",
        })
        .catch(() => null),
      client
        .readContract({
          address: owner,
          abi: safeAbi,
          functionName: "getThreshold",
        })
        .catch(() => null),
    ]);
    if (signers && threshold !== null)
      safe = { signers: [...signers], threshold };
  }
  return { owner, forward, resolver, safe };
}

export default function ContractPrimaryPage() {
  const { address, chainId: walletChainId } = useConnection();
  const [contractText, setContractText] = useState("");
  const [name, setName] = useState("");
  const contract = isAddress(contractText) ? (contractText as Address) : null;
  const checks = useQuery({
    queryKey: ["contract-primary", contract, name],
    queryFn: () => fetchChecks(contract!, name.trim()),
    enabled: !!contract,
    retry: 1,
  });
  const current = usePrimaryNames(contract ?? undefined, mainnet.id);
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: sending } = useWriteContract();
  const [tx, setTx] = useState<{ hash: Hex; target: PrimaryTarget } | null>(
    null,
  );
  const [signing, setSigning] = useState<PrimaryTarget | null>(null);
  const receipt = useWaitForTransactionReceipt({
    hash: tx?.hash,
    chainId: tx ? asChainId(tx.target.chain.id) : undefined,
  });
  const qc = useQueryClient();

  useEffect(() => {
    if (!tx || !receipt.isSuccess) return;
    qc.invalidateQueries({
      queryKey: primaryQueryKey(mainnet.id, contract ?? undefined),
    });
    toast.success(`primary name set on ${tx.target.label}`, {
      description: shortAddr(tx.hash, 8),
    });
  }, [tx, receipt.isSuccess, qc, contract]);

  const isOwner =
    !!address &&
    !!checks.data?.owner &&
    isAddressEqual(checks.data.owner, address);
  const safe = checks.data?.safe ?? null;
  const isSigner =
    !!address && !!safe && safe.signers.some((s) => isAddressEqual(s, address));
  const viaSafe = !isOwner && isSigner && safe!.threshold === 1n;
  const forwardOk =
    !!contract &&
    !!checks.data?.forward &&
    isAddressEqual(checks.data.forward, contract);
  const busy = !!signing || sending || (!!tx && receipt.isLoading);
  const ready =
    !!contract && !!name.trim() && (isOwner || viaSafe) && forwardOk && !busy;

  async function set(target: PrimaryTarget) {
    if (!contract || !address || !checks.data) return;
    setSigning(target);
    try {
      if (walletChainId !== target.chain.id)
        await switchChainAsync({ chainId: asChainId(target.chain.id) });
      const owner = checks.data.owner!;
      const hash = viaSafe
        ? await writeContractAsync({
            address: owner,
            abi: safeAbi,
            functionName: "execTransaction",
            args: [
              target.registrar,
              0n,
              encodeFunctionData({
                abi: homeRegistrarAbi,
                functionName: "setNameForAddr",
                args: [contract, owner, checks.data.resolver, name.trim()],
              }),
              0,
              0n,
              0n,
              0n,
              zeroAddress,
              zeroAddress,
              // pre-approved signature: the sender itself approves (v = 1, r = sender, s = 0)
              concat([
                pad(address, { size: 32 }),
                pad("0x0", { size: 32 }),
                "0x01",
              ]),
            ],
            chainId: asChainId(target.chain.id),
          })
        : await writeContractAsync({
            address: target.registrar,
            abi: homeRegistrarAbi,
            functionName: "setNameForAddr",
            args: [contract, owner, checks.data.resolver, name.trim()],
            chainId: asChainId(target.chain.id),
          });
      setTx({ hash, target });
      toast("transaction sent", {
        description: `${target.label} · ${shortAddr(hash, 8)}`,
      });
    } catch (e) {
      toast.error("could not set primary name", {
        description: (e as Error).message?.split("\n")[0]?.slice(0, 140),
      });
    } finally {
      setSigning(null);
    }
  }

  const nameOn = (kind: "home" | "default") =>
    current.data?.find((r) => r.target.kind === kind);

  return (
    <Section>
      <SectionHeader
        eyebrow="contract names"
        title="Name a contract you own"
        lede="Set the primary name of an Ownable contract from its owner wallet."
      />
      <Figure
        n={1}
        name={`contract primary · ${name || "…"}`}
        padded={false}
        dotted={false}
      >
        <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <Label htmlFor="cp-contract">contract</Label>
            <Input
              id="cp-contract"
              className="mt-2"
              value={contractText}
              onChange={(e) => setContractText(e.target.value.trim())}
              placeholder="0x…"
              spellCheck={false}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="cp-name">name</Label>
            <Input
              id="cp-name"
              className="mt-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="alice.eth"
              spellCheck={false}
            />
          </div>
        </div>

        <ul
          className="t-fig-body space-y-1.5 border-b border-line p-4 sm:p-5"
          data-testid="cp-checks"
        >
          <li>
            {!contract ? (
              <StatusText tone="err">enter a contract address.</StatusText>
            ) : checks.isLoading ? (
              <StatusText tone="wait">reading the contract…</StatusText>
            ) : checks.data?.owner ? (
              <>
                owner <AddressLink address={checks.data.owner} chars={4} />{" "}
                {safe ? (
                  <span className="text-ink-dim">
                    (a safe, {safe.threshold.toString()} of{" "}
                    {safe.signers.length}){" "}
                  </span>
                ) : null}
                {!address ? (
                  <StatusText tone="wait">
                    · connect that wallet{safe ? " or one of its signers" : ""}
                  </StatusText>
                ) : isOwner ? (
                  <StatusText tone="ok">· that's you</StatusText>
                ) : viaSafe ? (
                  <StatusText tone="ok">· you can sign for it</StatusText>
                ) : isSigner ? (
                  <StatusText tone="err">
                    · you can sign for it, but it needs{" "}
                    {safe!.threshold.toString()} signatures: use the safe app
                  </StatusText>
                ) : (
                  <StatusText tone="err">
                    · you are connected as {shortAddr(address)}
                  </StatusText>
                )}
              </>
            ) : (
              <StatusText tone="err">
                no owner(): not an Ownable contract.
              </StatusText>
            )}
          </li>
          <li>
            {!contract || checks.isLoading ? null : checks.data?.forward ? (
              forwardOk ? (
                <>
                  <StatusText tone="ok">
                    {name.trim()} resolves to this contract
                  </StatusText>
                </>
              ) : (
                <StatusText tone="err">
                  {name.trim()} resolves to {shortAddr(checks.data.forward)},
                  not this contract. the primary name will not verify.
                </StatusText>
              )
            ) : (
              <StatusText tone="err">
                {name.trim() || "the name"} has no eth address.
              </StatusText>
            )}
          </li>
          {contract ? (
            <li>
              primary name now · ethereum{" "}
              {current.isLoading ? (
                "…"
              ) : nameOn("home")?.name && !nameOn("home")?.viaDefault ? (
                <span className="text-ink">{nameOn("home")!.name}</span>
              ) : (
                <span className="text-ink-dim">none</span>
              )}
              {" · "}default{" "}
              {current.isLoading ? (
                "…"
              ) : nameOn("default")?.name ? (
                <span className="text-ink">{nameOn("default")!.name}</span>
              ) : (
                <span className="text-ink-dim">none</span>
              )}
            </li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
          <Button variant="accent" disabled={!ready} onClick={() => set(HOME)}>
            {signing?.kind === "home"
              ? "confirm in wallet…"
              : viaSafe
                ? "set on ethereum through the safe"
                : "set on ethereum"}
          </Button>
          {tx ? (
            <span className="text-[11px]">
              {receipt.isSuccess ? (
                <StatusText tone="ok">set on {tx.target.label}</StatusText>
              ) : receipt.isError ? (
                <StatusText tone="err">failed</StatusText>
              ) : (
                <StatusText tone="wait">mining</StatusText>
              )}{" "}
              <a
                className="link-blue text-ink-dim"
                href={`${tx.target.explorer}/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(tx.hash, 6)}
              </a>
            </span>
          ) : null}
        </div>
      </Figure>
      <p className="t-caption mt-4 normal-case tracking-normal">
        writes the contract's addr.reverse record through the v1 reverse
        registrar, owned by the contract's owner and using the registrar's
        default resolver. a safe owner with a threshold of 1 is called directly
        from a signer, one transaction.
      </p>
    </Section>
  );
}
