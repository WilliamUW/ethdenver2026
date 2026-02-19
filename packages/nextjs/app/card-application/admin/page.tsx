"use client";

import { useMemo, useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { CreditDashboard, type CreditDashboardProfile } from "~~/components/CreditDashboard";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import toast from "react-hot-toast";

type ApplicationStruct = {
  applicant: string;
  status: bigint;
  createdAt: bigint;
  decidedAt: bigint;
};

type CreditProfile = {
  country: string;
  name: string;
  score: string;
  ageMonths: bigint;
  cards: bigint;
  totalAccounts: bigint;
  utilization: string;
  delinquencies: bigint;
  ipfsCid: string;
  timestamp: bigint;
};

const STATUS_LABELS: Record<number, { label: string; color: string; bgColor: string; icon: string }> = {
  0: { label: "None", color: "text-gray-400", bgColor: "bg-gray-500/20", icon: "⚪" },
  1: { label: "Pending", color: "text-yellow-400", bgColor: "bg-yellow-500/20", icon: "⏳" },
  2: { label: "Approved", color: "text-green-400", bgColor: "bg-green-500/20", icon: "✅" },
  3: { label: "Rejected", color: "text-red-400", bgColor: "bg-red-500/20", icon: "❌" },
};

const AdminCardApplicationsPage = () => {
  const { address } = useAccount();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: applicants } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getAllApplicants",
    watch: true,
  }) as { data: string[] | undefined };

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CreditCardApplications",
  });

  const handleDecision = async (applicant: string, approve: boolean) => {
    setProcessingId(applicant);
    try {
      await writeContractAsync({
        functionName: approve ? "approve" : "reject",
        args: [applicant],
      });
      toast.success(`Application ${approve ? "approved" : "rejected"} successfully!`);
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${approve ? "approve" : "reject"} application`);
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetAll = async () => {
    if (!confirm("⚠️ Delete all applications? This action cannot be undone.")) return;
    try {
      await writeContractAsync({
        functionName: "resetAll",
        args: [],
      });
      toast.success("All applications have been reset");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset applications");
      console.error(e);
    }
  };

  // We'll calculate stats from individual application cards

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Application Dashboard</h1>
            <p className="text-indigo-200">Review and manage credit card applications</p>
          </div>
          <div className="flex items-center gap-4">
            {applicants && applicants.length > 0 && (
              <button
                onClick={handleResetAll}
                disabled={!address || isPending}
                className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-lg border border-red-500/30"
              >
                🗑️ Reset All
              </button>
            )}
            <ConnectButton />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-indigo-200 text-sm mb-2">Total Applications</div>
            <div className="text-3xl font-bold text-white">{applicants?.length || 0}</div>
          </div>
          <StatsCards applicants={applicants} />
        </div>

        {/* Applications List */}
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Applications</h2>
            {applicants && applicants.length > 0 && (
              <div className="text-indigo-200 text-sm">
                {applicants.length} {applicants.length === 1 ? "application" : "applications"}
              </div>
            )}
          </div>

          {!applicants || applicants.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <div className="text-white text-xl font-semibold mb-2">No applications yet</div>
              <div className="text-indigo-200">Applications will appear here once submitted</div>
            </div>
          ) : (
            <div className="grid gap-4">
              {applicants.map(applicant => (
                <AdminApplicationCard
                  key={applicant}
                  applicant={applicant}
                  disabled={!address || isPending || processingId === applicant}
                  onDecision={handleDecision}
                  isProcessing={processingId === applicant}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type StatsCardsProps = {
  applicants?: string[];
};

const StatsCards: React.FC<StatsCardsProps> = ({ applicants }) => {
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    if (!applicants || applicants.length === 0) {
      setStats({ pending: 0, approved: 0, rejected: 0 });
      return;
    }

    // We'll update stats as applications load
    // For now, show placeholder
    setStats({ pending: 0, approved: 0, rejected: 0 });
  }, [applicants]);

  return (
    <>
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="text-indigo-200 text-sm mb-2">Pending Review</div>
        <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
      </div>
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="text-indigo-200 text-sm mb-2">Approved</div>
        <div className="text-3xl font-bold text-green-400">{stats.approved}</div>
      </div>
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="text-indigo-200 text-sm mb-2">Rejected</div>
        <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
      </div>
    </>
  );
};

type CardProps = {
  applicant: string;
  disabled: boolean;
  onDecision: (applicant: string, approve: boolean) => void;
  isProcessing: boolean;
};

const AdminApplicationCard: React.FC<CardProps> = ({ applicant, disabled, onDecision, isProcessing }) => {
  const { data: application } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getApplication",
    args: [applicant],
    watch: true,
  }) as { data: ApplicationStruct | undefined };

  const { data: creditProfiles } = useScaffoldReadContract({
    contractName: "CreditPassport",
    functionName: "getProfiles",
    args: [applicant],
    watch: true,
  }) as { data: CreditProfile[] | undefined };

  const status = useMemo(() => {
    if (!application) return 0;
    const raw = Array.isArray(application) ? application[1] : application.status;
    return Number(raw ?? 0n);
  }, [application]);

  const [selectedProfileIndex, setSelectedProfileIndex] = useState<number>(0);

  // Parse all profiles from blockchain
  const allProfiles = useMemo(() => {
    if (!creditProfiles) return [];
    
    const profiles: any[] = [];
    if (Array.isArray(creditProfiles)) {
      creditProfiles.forEach((profile: any) => {
        if (Array.isArray(profile)) {
          // Tuple format: [country, name, score, ageMonths, cards, totalAccounts, utilization, delinquencies, ipfsCid, timestamp]
          profiles.push({
            country: profile[0],
            name: profile[1],
            score: profile[2],
            ageMonths: profile[3],
            cards: profile[4],
            totalAccounts: profile[5],
            utilization: profile[6],
            delinquencies: profile[7],
            ipfsCid: profile[8],
            timestamp: profile[9],
          });
        } else if (typeof profile === 'object') {
          profiles.push(profile);
        }
      });
    }
    return profiles;
  }, [creditProfiles]);

  const selectedProfile = allProfiles[selectedProfileIndex] || null;
  const latestProfile = allProfiles.length > 0 ? allProfiles[allProfiles.length - 1] : null;

  const dashboardProfiles: CreditDashboardProfile[] = useMemo(
    () =>
      allProfiles.map(p => ({
        country: String(p.country ?? ""),
        ageMonths: Number(p.ageMonths ?? 0),
        cards: Number(p.cards ?? 0),
        totalAccounts: Number(p.totalAccounts ?? 0),
        utilization: String(p.utilization ?? "0%"),
        delinquencies: Number(p.delinquencies ?? 0),
        timestamp: p.timestamp != null ? Number(p.timestamp) : undefined,
        score: p.score != null ? String(p.score) : undefined,
        name: p.name != null ? String(p.name) : undefined,
      })),
    [allProfiles],
  );

  const creditScore = useMemo(() => {
    if (!selectedProfile) return null;
    const scoreStr = selectedProfile.score?.toString();
    if (!scoreStr) return null;
    // Handle "740/850" format
    const parts = scoreStr.split('/');
    const scoreNum = parseInt(parts[0] || scoreStr);
    return isNaN(scoreNum) ? null : scoreNum;
  }, [selectedProfile]);

  const createdAt = useMemo(() => {
    if (!application) return null;
    const ts = Array.isArray(application) ? application[2] : application.createdAt;
    return ts ? new Date(Number(ts) * 1000) : null;
  }, [application]);

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS[0];

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:border-white/40 transition-all">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Applicant Info */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-indigo-200 text-sm mb-2">Applicant</div>
              <Address address={applicant} />
              {latestProfile && (
                <div className="text-white/60 text-sm mt-1">
                  {latestProfile.name || "Unknown"}
                </div>
              )}
            </div>
            <div className={`px-4 py-2 rounded-xl ${statusInfo.bgColor} border ${statusInfo.color.replace('text-', 'border-')}/30`}>
              <div className="flex items-center gap-2">
                <span>{statusInfo.icon}</span>
                <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Aggregate metrics (reusable CreditDashboard) */}
          {dashboardProfiles.length > 0 && (
            <CreditDashboard
              profiles={dashboardProfiles}
              title="Applicant aggregate metrics"
              className="border-white/20"
            />
          )}

          {/* Credit Profiles Dropdown */}
          {allProfiles.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-indigo-200 text-sm font-semibold">Credit Profiles</div>
                <div className="text-white/60 text-xs">{allProfiles.length} profile{allProfiles.length !== 1 ? 's' : ''}</div>
              </div>
              {allProfiles.length > 1 && (
                <select
                  value={selectedProfileIndex}
                  onChange={(e) => setSelectedProfileIndex(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {allProfiles.map((profile, idx) => (
                    <option key={idx} value={idx} className="bg-slate-800">
                      {profile.country || 'Unknown'} • {profile.score || 'N/A'} • {profile.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Selected Profile Details */}
              {selectedProfile && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-indigo-200 text-sm">Credit Score</div>
                    <div className="text-2xl font-bold text-white">
                      {creditScore !== null ? creditScore : selectedProfile.score || 'N/A'}
                    </div>
                  </div>
                  {creditScore !== null && (
                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          creditScore >= 750
                            ? "bg-gradient-to-r from-green-400 to-emerald-600"
                            : creditScore >= 700
                            ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                            : "bg-gradient-to-r from-red-400 to-pink-600"
                        }`}
                        style={{ width: `${Math.min((creditScore / 850) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                    <div>
                      <span className="text-indigo-200">Country:</span> {selectedProfile.country || 'N/A'}
                    </div>
                    <div>
                      <span className="text-indigo-200">Name:</span> {selectedProfile.name || 'N/A'}
                    </div>
                    <div>
                      <span className="text-indigo-200">Cards:</span> {selectedProfile.cards?.toString() || '0'}
                    </div>
                    <div>
                      <span className="text-indigo-200">Accounts:</span> {selectedProfile.totalAccounts?.toString() || '0'}
                    </div>
                    <div>
                      <span className="text-indigo-200">Utilization:</span> {selectedProfile.utilization || 'N/A'}
                    </div>
                    <div>
                      <span className="text-indigo-200">Delinquencies:</span> {selectedProfile.delinquencies?.toString() || '0'}
                    </div>
                    <div>
                      <span className="text-indigo-200">History:</span> {selectedProfile.ageMonths?.toString() || '0'} months
                    </div>
                    {selectedProfile.timestamp && (
                      <div>
                        <span className="text-indigo-200">Added:</span>{' '}
                        {new Date(Number(selectedProfile.timestamp) * 1000).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  
                  {/* Pinata IPFS link to AI credit analysis and credit summary */}
                  {selectedProfile.ipfsCid && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-indigo-200 text-xs font-semibold mb-2">📄 Pinata IPFS link to AI credit analysis and credit summary</div>
                      <div className="text-white/60 text-xs mb-2">
                        View the full report with AI analysis and detailed credit summary on Pinata.
                      </div>
                      <a
                        href={`https://brown-real-puma-604.mypinata.cloud/ipfs/${selectedProfile.ipfsCid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200 text-xs break-all underline transition-colors"
                      >
                        <span>🔗</span>
                        <span className="font-mono">{selectedProfile.ipfsCid}</span>
                        <span className="text-xs">↗</span>
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* No Credit Profile Message */}
          {allProfiles.length === 0 && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
              <div className="text-white/60 text-sm">No credit profiles found</div>
              <div className="text-white/40 text-xs mt-1">This applicant hasn't added any credit profiles yet</div>
            </div>
          )}

          {createdAt && (
            <div className="text-white/60 text-sm">
              Applied: {createdAt.toLocaleDateString()} at {createdAt.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col justify-center gap-3 lg:w-48">
          {status === 1 ? (
            <>
              <button
                onClick={() => onDecision(applicant, true)}
                disabled={disabled}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>Approve</span>
                  </>
                )}
              </button>
              <button
                onClick={() => onDecision(applicant, false)}
                disabled={disabled}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>❌</span>
                    <span>Reject</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center text-white/60 py-3">
              {status === 2 && <div className="text-green-400 font-semibold">✓ Approved</div>}
              {status === 3 && <div className="text-red-400 font-semibold">✗ Rejected</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCardApplicationsPage;
