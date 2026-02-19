"use client";

import { useMemo } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

type ApplicationStruct = {
  applicant: string;
  status: bigint;
  createdAt: bigint;
  decidedAt: bigint;
};

const STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Pending",
  2: "Approved",
  3: "Rejected",
};

const CardApplicationPage = () => {
  const { address } = useAccount();

  const { data: myApplication } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getMyApplication",
    watch: true,
  }) as { data: ApplicationStruct | undefined };

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CreditCardApplications",
  });

  const hasApplication = useMemo(() => {
    if (!myApplication) return false;
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    return myApplication.applicant.toLowerCase() !== zeroAddress;
  }, [myApplication]);

  const statusLabel = useMemo(() => {
    if (!hasApplication) return "No application yet";
    const raw = Number(myApplication?.status ?? 0n);
    return STATUS_LABELS[raw] ?? `Unknown (${raw})`;
  }, [hasApplication, myApplication]);

  const canApply = useMemo(() => {
    if (!hasApplication) return true;
    const raw = Number(myApplication?.status ?? 0n);
    return raw === 0;
  }, [hasApplication, myApplication]);

  const handleApply = async () => {
    try {
      await writeContractAsync({
        functionName: "submitApplication",
        args: [],
      });
    } catch (e) {
      // swallow for now; this is just a demo button
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Credit Card Application</h2>
        <ConnectButton />
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-semibold">Your wallet</p>
        {address ? <Address address={address} /> : <p>Connect a wallet to apply.</p>}
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-semibold">Application status</p>
        <p>{statusLabel}</p>
        {myApplication && myApplication.createdAt > 0 && (
          <p className="text-sm text-gray-500">
            Created at block time: {myApplication.createdAt.toString()}
            {myApplication.decidedAt > 0n ? ` · Decided at: ${myApplication.decidedAt.toString()}` : ""}
          </p>
        )}
      </div>

      <button
        className="btn btn-primary"
        disabled={!address || !canApply || isPending}
        onClick={handleApply}
      >
        {isPending ? "Submitting..." : "Submit application"}
      </button>

      {!canApply && <p className="text-sm text-gray-500">You can only submit one application per address.</p>}
    </div>
  );
};

export default CardApplicationPage;

