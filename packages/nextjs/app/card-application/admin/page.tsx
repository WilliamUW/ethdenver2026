"use client";

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

const AdminCardApplicationsPage = () => {
  const { address } = useAccount();

  const { data: applicants } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getAllApplicants",
    watch: true,
  }) as { data: string[] | undefined };

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CreditCardApplications",
  });

  const handleDecision = async (applicant: string, approve: boolean) => {
    try {
      await writeContractAsync({
        functionName: approve ? "approve" : "reject",
        args: [applicant],
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("Delete all applications? This cannot be undone.")) return;
    try {
      await writeContractAsync({
        functionName: "resetAll",
        args: [],
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review – Credit Card Applications</h2>
        <ConnectButton />
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-semibold">Connected wallet</p>
        {address ? <Address address={address} /> : <p>Connect a wallet to review applications.</p>}
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">All applications</p>
          {applicants && applicants.length > 0 && (
            <button
              className="btn btn-sm btn-error"
              disabled={!address || isPending}
              onClick={handleResetAll}
            >
              Delete all
            </button>
          )}
        </div>
        {!applicants || applicants.length === 0 ? (
          <p>No applications yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {applicants.map(applicant => (
              <AdminApplicationRow
                key={applicant}
                applicant={applicant}
                disabled={!address || isPending}
                onDecision={handleDecision}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

type RowProps = {
  applicant: string;
  disabled: boolean;
  onDecision: (applicant: string, approve: boolean) => void;
};

const AdminApplicationRow: React.FC<RowProps> = ({ applicant, disabled, onDecision }) => {
  const { data: application } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getApplication",
    args: [applicant],
    watch: true,
  }) as { data: ApplicationStruct | undefined };

  const status = Number(application?.status ?? 0n);
  const statusLabel = STATUS_LABELS[status] ?? `Unknown (${status})`;

  return (
    <div className="flex items-center justify-between border rounded-lg p-3 gap-4">
      <div className="flex flex-col gap-1">
        <Address address={applicant} />
        <p className="text-sm">
          Status: <span className="font-semibold">{statusLabel}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-sm btn-success"
          disabled={disabled || status !== 1}
          onClick={() => onDecision(applicant, true)}
        >
          Approve
        </button>
        <button
          className="btn btn-sm btn-error"
          disabled={disabled || status !== 1}
          onClick={() => onDecision(applicant, false)}
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default AdminCardApplicationsPage;

