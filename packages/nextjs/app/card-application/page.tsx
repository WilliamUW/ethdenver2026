"use client";

import { useMemo, useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
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

const STATUS_LABELS: Record<number, { label: string; color: string; icon: string }> = {
  0: { label: "No Application", color: "text-gray-500", icon: "📝" },
  1: { label: "Under Review", color: "text-yellow-500", icon: "⏳" },
  2: { label: "Approved", color: "text-green-500", icon: "✅" },
  3: { label: "Declined", color: "text-red-500", icon: "❌" },
};

const CardApplicationPage = () => {
  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: myApplication } = useScaffoldReadContract({
    contractName: "CreditCardApplications",
    functionName: "getApplication",
    args: address ? [address] : undefined,
    watch: true,
  }) as { data: ApplicationStruct | undefined };

  const { data: creditProfiles } = useScaffoldReadContract({
    contractName: "CreditPassport",
    functionName: "getProfiles",
    args: address ? [address] : undefined,
    watch: true,
  }) as { data: CreditProfile[] | undefined };

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CreditCardApplications",
  });

  const hasApplication = useMemo(() => {
    if (!myApplication) return false;
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    return myApplication.applicant.toLowerCase() !== zeroAddress;
  }, [myApplication]);

  const status = useMemo(() => {
    if (!hasApplication) return 0;
    return Number(myApplication?.status ?? 0n);
  }, [hasApplication, myApplication]);

  const latestProfile = useMemo(() => {
    if (!creditProfiles) return null;
    // Handle both array and object formats
    if (Array.isArray(creditProfiles)) {
      if (creditProfiles.length === 0) return null;
      const last = creditProfiles[creditProfiles.length - 1];
      return Array.isArray(last) ? last : last;
    }
    if (typeof creditProfiles === 'object' && 'length' in creditProfiles) {
      const arr = creditProfiles as any[];
      return arr.length > 0 ? arr[arr.length - 1] : null;
    }
    return null;
  }, [creditProfiles]);

  const creditScore = useMemo(() => {
    if (!latestProfile) return null;
    let scoreStr: string | undefined;
    
    if (Array.isArray(latestProfile)) {
      scoreStr = latestProfile[2]?.toString();
    } else if (typeof latestProfile === 'object') {
      scoreStr = (latestProfile as any).score?.toString();
    }
    
    if (!scoreStr) return null;
    const scoreNum = parseInt(scoreStr);
    return isNaN(scoreNum) ? null : scoreNum;
  }, [latestProfile]);

  const canApply = !hasApplication;

  const handleApply = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }
    setIsSubmitting(true);
    try {
      await writeContractAsync({
        functionName: "submitApplication",
        args: [],
      });
      toast.success("Application submitted successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit application");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Premium Credit Card</h1>
            <p className="text-blue-200">Experience the future of financial services</p>
          </div>
          <ConnectButton />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Card Visualization */}
          <div className="space-y-6">
            {/* 3D Card Preview */}
            <div className="relative perspective-1000">
              <div className="transform-gpu transition-transform duration-500 hover:rotate-y-12">
                <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-3xl p-8 shadow-2xl min-h-[280px] flex flex-col justify-between text-white overflow-hidden">
                  {/* Card Pattern Overlay */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24" />
                  </div>

                  {/* Card Content */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="text-sm opacity-80 mb-1">CARD NUMBER</div>
                        <div className="text-2xl font-mono tracking-wider">•••• •••• •••• 4242</div>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded" />
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-sm opacity-80 mb-1">CARDHOLDER</div>
                        <div className="text-xl font-semibold">
                          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "YOUR NAME"}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">EXPIRES</div>
                        <div className="text-lg">12/28</div>
                      </div>
                    </div>
                  </div>

                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine" />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">💳</div>
                <div className="text-white font-semibold">No Annual Fee</div>
                <div className="text-blue-200 text-sm">First year free</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">✈️</div>
                <div className="text-white font-semibold">Travel Rewards</div>
                <div className="text-blue-200 text-sm">2x points on travel</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-white font-semibold">Secure</div>
                <div className="text-blue-200 text-sm">Blockchain verified</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-white font-semibold">Instant Approval</div>
                <div className="text-blue-200 text-sm">Decisions in minutes</div>
              </div>
            </div>
          </div>

          {/* Right: Application Form & Status */}
          <div className="space-y-6">
            {/* Credit Score Display */}
            {creditScore !== null && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-blue-200 text-sm mb-1">Your Credit Score</div>
                    <div className="text-4xl font-bold text-white">{creditScore}</div>
                  </div>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-2xl">
                    📊
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-1000"
                    style={{ width: `${Math.min((creditScore / 850) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-blue-200 text-xs mt-2">
                  {latestProfile && (
                    <>
                      {Array.isArray(latestProfile) ? latestProfile[1] : (latestProfile as any).name || "Unknown"} •{" "}
                      {Array.isArray(latestProfile) ? latestProfile[0] : (latestProfile as any).country || "Unknown"}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Application Status */}
            {hasApplication && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">{statusInfo.icon}</div>
                  <div>
                    <div className="text-blue-200 text-sm mb-1">Application Status</div>
                    <div className={`text-2xl font-bold ${statusInfo.color}`}>{statusInfo.label}</div>
                  </div>
                </div>
                {myApplication && myApplication.createdAt > 0n && (
                  <div className="text-blue-200 text-sm space-y-1">
                    <div>
                      Submitted: {new Date(Number(myApplication.createdAt) * 1000).toLocaleDateString()}
                    </div>
                    {myApplication.decidedAt > 0n && (
                      <div>
                        Decided: {new Date(Number(myApplication.decidedAt) * 1000).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Wallet Info */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="text-blue-200 text-sm mb-2">Connected Wallet</div>
              {address ? (
                <div className="flex items-center gap-3">
                  <Address address={address} />
                </div>
              ) : (
                <div className="text-white/60">Please connect your wallet to continue</div>
              )}
            </div>

            {/* Apply Button */}
            {canApply && (
              <button
                onClick={handleApply}
                disabled={!address || isPending || isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 px-8 rounded-2xl text-lg shadow-2xl transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {isPending || isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-md" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Apply Now</span>
                  </>
                )}
              </button>
            )}

            {!canApply && status === 1 && (
              <div className="bg-yellow-500/20 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30">
                <div className="text-yellow-200 text-center">
                  <div className="text-2xl mb-2">⏳</div>
                  <div className="font-semibold">Your application is under review</div>
                  <div className="text-sm mt-2">We'll notify you once a decision has been made</div>
                </div>
              </div>
            )}

            {status === 2 && (
              <div className="bg-green-500/20 backdrop-blur-lg rounded-2xl p-6 border border-green-500/30">
                <div className="text-green-200 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <div className="font-bold text-2xl mb-2">Congratulations!</div>
                  <div className="text-lg mb-4">Your application has been approved</div>
                  <div className="text-sm">You'll receive your card details shortly</div>
                </div>
              </div>
            )}

            {status === 3 && (
              <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-6 border border-red-500/30">
                <div className="text-red-200 text-center">
                  <div className="text-4xl mb-3">😔</div>
                  <div className="font-bold text-2xl mb-2">Application Declined</div>
                  <div className="text-sm">We were unable to approve your application at this time</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shine {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shine {
          animation: shine 3s infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-y-12 {
          transform: rotateY(12deg);
        }
      `}</style>
    </div>
  );
};

export default CardApplicationPage;
