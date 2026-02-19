"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import toast from "react-hot-toast";

const CONFETTI_COLORS = ["#FFD700", "#FF6B35", "#00C9A7", "#845EC2", "#FF8066", "#4D96FF", "#E8D5B7", "#C1121F"];
const CONFETTI_COUNT = 80;

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
  const [schufaModalOpen, setSchufaModalOpen] = useState(false);
  const [schufaPhase, setSchufaPhase] = useState<"spinning" | "declined">("spinning");
  const [approvalCelebrationOpen, setApprovalCelebrationOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

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

  useEffect(() => {
    if (!schufaModalOpen || schufaPhase !== "spinning") return;
    const t = setTimeout(() => setSchufaPhase("declined"), 3000);
    return () => clearTimeout(t);
  }, [schufaModalOpen, schufaPhase]);

  const openSchufaModal = useCallback(() => {
    setSchufaPhase("spinning");
    setSchufaModalOpen(true);
  }, []);

  const closeSchufaModal = useCallback(() => {
    setSchufaModalOpen(false);
    setSchufaPhase("spinning");
  }, []);

  const openApprovalCelebration = useCallback(() => {
    setConfettiKey(k => k + 1);
    setApprovalCelebrationOpen(true);
  }, []);

  const confettiPieces = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 8,
      duration: 2.5 + Math.random() * 1.5,
    }));
  }, [confettiKey]);

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

      {/* SCHUFA modal: 3s spinner then decline message */}
      {schufaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
          <div className="bg-slate-800/95 border border-white/20 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            {schufaPhase === "spinning" ? (
              <div className="p-8 flex flex-col items-center gap-6">
                <span className="loading loading-spinner loading-lg text-amber-400" />
                <p className="text-white font-semibold text-center">Checking SCHUFA score…</p>
                <p className="text-blue-200 text-sm text-center">Verifying your German credit file</p>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-4">😔</div>
                  <h3 className="text-xl font-bold text-red-300 mb-2">Unable to approve</h3>
                  <p className="text-white/90 text-sm leading-relaxed">
                    You do not have a German credit score, or your credit history is less than 6 months old. We are
                    unable to approve your application with SCHUFA at this time.
                  </p>
                  <p className="text-white/70 text-xs mt-3">
                    Try applying with your <strong className="text-amber-200">global credit score</strong> instead.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSchufaModal}
                  className="w-full btn bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl py-3"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval celebration modal: confetti + 5,000 EUR */}
      {approvalCelebrationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          {/* Confetti layer */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {confettiPieces.map(p => (
              <div
                key={p.id}
                className="absolute rounded-sm animate-confetti-fall"
                style={{
                  left: `${p.left}%`,
                  top: "-20px",
                  width: p.size,
                  height: p.size * 1.4,
                  backgroundColor: p.color,
                  transform: `rotate(${p.rotation}deg)`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
          <div className="relative z-10 bg-slate-800/95 border-2 border-amber-400/50 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            <div className="p-8 sm:p-10 text-center">
              <div className="text-6xl sm:text-7xl mb-4 animate-bounce">🎉</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">You&apos;re approved!</h2>
              <p className="text-amber-200 text-lg sm:text-xl font-semibold mb-6">
                Based on your global credit history, you are approved for a <span className="text-2xl sm:text-3xl font-bold text-amber-300">5,000 EUR</span> credit limit.
              </p>
              <p className="text-white/80 text-sm mb-8">
                Your Deutsche Premium Kreditkarte is on its way. Enjoy rewards and peace of mind.
              </p>
              <button
                type="button"
                onClick={() => setApprovalCelebrationOpen(false)}
                className="btn bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold rounded-xl px-8 py-3 shadow-lg"
              >
                Amazing!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Deutsche Premium Kreditkarte</h1>
            <p className="text-blue-200">German credit card — apply with SCHUFA or your global credit score</p>
          </div>
          <ConnectButton />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Card Visualization */}
          <div className="space-y-6">
            {/* 3D Card Preview — German theme (black / red / gold) */}
            <div className="relative perspective-1000">
              <div className="transform-gpu transition-transform duration-500 hover:rotate-y-12">
                <div className="relative rounded-3xl p-8 shadow-2xl min-h-[280px] flex flex-col justify-between text-white overflow-hidden border border-amber-500/30">
                  {/* German flag stripes (horizontal): black, red, gold */}
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 bg-black/90" />
                    <div className="flex-1 bg-red-600/95" />
                    <div className="flex-1 bg-amber-500/90" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-amber-900/20" />

                  {/* Card Content */}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Kartennummer</div>
                        <div className="text-2xl font-mono tracking-wider">•••• •••• •••• 4242</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-200/90">DE</span>
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-xl">🇩🇪</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Karteninhaber</div>
                        <div className="text-xl font-semibold">
                          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "IHR NAME"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-widest text-white/70 mb-1">Gültig bis</div>
                        <div className="text-lg">12/28</div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <span className="text-amber-200/90 text-sm font-medium">Deutsche Premium Kreditkarte</span>
                    </div>
                  </div>

                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">💳</div>
                <div className="text-white font-semibold">Keine Jahresgebühr</div>
                <div className="text-blue-200 text-sm">Erstes Jahr kostenlos</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">✈️</div>
                <div className="text-white font-semibold">Reise-Prämien</div>
                <div className="text-blue-200 text-sm">2x Punkte auf Reisen</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-white font-semibold">Sicher</div>
                <div className="text-blue-200 text-sm">Blockchain verifiziert</div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-white font-semibold">Schnelle Entscheidung</div>
                <div className="text-blue-200 text-sm">In Minuten</div>
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

            {/* Apply with SCHUFA (German bureau) */}
            {canApply && (
              <button
                type="button"
                onClick={openSchufaModal}
                disabled={!address}
                className="w-full bg-white/10 hover:bg-white/20 border-2 border-amber-500/50 hover:border-amber-400/70 text-amber-200 font-bold py-4 px-6 rounded-2xl text-base shadow-lg transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                <span>🇩🇪</span>
                <span>Apply with SCHUFA</span>
              </button>
            )}

            {/* Apply with global credit score */}
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
                    <span>🌍</span>
                    <span>Apply with global credit score</span>
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
              <button
                type="button"
                onClick={openApprovalCelebration}
                className="w-full text-left bg-green-500/20 hover:bg-green-500/30 backdrop-blur-lg rounded-2xl p-6 border-2 border-green-500/30 hover:border-green-400/50 transition-all duration-200 hover:scale-[1.01] hover:shadow-xl cursor-pointer"
              >
                <div className="text-green-200 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <div className="font-bold text-2xl mb-2">Congratulations!</div>
                  <div className="text-lg mb-4">Your application has been approved</div>
                  <div className="text-sm text-green-300/90">Click to see your credit limit details →</div>
                </div>
              </button>
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
      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation-name: confetti-fall;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CardApplicationPage;
