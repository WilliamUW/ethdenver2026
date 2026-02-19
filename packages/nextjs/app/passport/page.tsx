"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import toast from "react-hot-toast";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";


const COUNTRIES = [
  { value: "Canada", label: "Canada" },
  { value: "USA", label: "USA" },
  { value: "Mexico", label: "Mexico" },
  { value: "UK", label: "UK" },
  { value: "Germany", label: "Germany" },
  { value: "Japan", label: "Japan" },
  { value: "Singapore", label: "Singapore" },
] as const;

type ParsedProfile = {
  country: string;
  name: string;
  score: string;
  ageMonths: number;
  cards: number;
  totalAccounts: number;
  utilization: string;
  delinquencies: number;
  analysis: string;
  markdownSummary: string;
};

type SavedProfile = {
  country: string;
  name: string;
  score: string;
  scoreNum: number;
  scoreMax: number;
  ageMonths: number;
  cards: number;
  totalAccounts: number;
  utilization: string;
  delinquencies: number;
  timestamp: number;
  ipfsCid?: string;
};

const COUNTRY_FLAGS: Record<string, string> = {
  Canada: "🇨🇦",
  USA: "🇺🇸",
  Mexico: "🇲🇽",
  UK: "🇬🇧",
  Germany: "🇩🇪",
  Japan: "🇯🇵",
  Singapore: "🇸🇬",
};

const PINATA_GATEWAY_BASE = "https://brown-real-puma-604.mypinata.cloud/ipfs/";

const EXTRACTION_PROMPT = `You are a credit report parser. Extract the following fields from the credit report text below and return ONLY a valid JSON object with no other text, no markdown, no code fence. Use exactly these keys:
- country (string): use the country provided by the user
- name (string): account holder name if present, else "Unknown"
- score (string): credit score, format like "720/850" or "680/900" (score/max). If only one number given, use that number and common max for that country (e.g. 850 USA, 900 Canada)
- ageMonths (number): length of credit history in months, or 0 if unknown
- cards (number): number of credit cards or revolving accounts
- totalAccounts (number): total number of credit accounts (cards, loans, etc.)
- utilization (string): credit utilization as percentage, e.g. "28%"
- delinquencies (number): number of late payments or delinquencies, 0 if none/none mentioned
- analysis (string): a SHORT AI analysis paragraph (3–5 sentences maximum) of the user's credit score and profile, focusing on the single most important strength, the single most important risk factor, and 2–3 concrete suggestions for improvement. Use clear, plain language and avoid lists or bullet points in this field.
- markdownSummary (string): a VERY DETAILED and BEAUTIFULLY FORMATTED Markdown summary of the credit report. Structure it with rich headings, subheadings, and visual variation. At minimum include sections like:
  - "# Overview" with key high-level bullets
  - "## Score & History" with bold labels and inline values
  - "## Accounts Breakdown" listing EVERY available credit card and other accounts, with bullets that show issuer / type, status (open/closed), credit limit, current balance, and any notable remarks
  - "## Utilization & Risk Factors" with clearly separated subsections for utilization, recent inquiries, delinquencies, and any derogatory items
  - "## Recommendations" with clearly formatted bullet points grouped under at least two subheadings (for example "Short term" and "Long term").
Use a mix of heading levels (#, ##, ###), bold text, bullet lists, and occasional inline code-style backticks for labels where appropriate to make the Markdown visually appealing and easy to scan.

PRIVACY REQUIREMENTS:
- Do NOT include any personally identifying information beyond the account holder's name.
- Never include addresses, dates of birth, social security numbers (SSN), social insurance numbers (SIN), tax IDs, account numbers, or similar sensitive identifiers.

If a value cannot be found, use null for that key. Return only the JSON object.`;

async function callGemini(
  apiKey: string,
  userPrompt: string,
  options?: { responseJson?: boolean },
): Promise<string> {
  const body: {
    model: string;
    messages: Array<{ role: "user"; content: string }>;
    response_format?: { type: "json_object" | "text" };
  } = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userPrompt }],
  };

  if (options?.responseJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw}`);
  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? raw;
  return text;
}

function extractJsonFromResponse(text: string): string {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  return trimmed;
}

function parseExtractionPayload(jsonStr: string, country: string): ParsedProfile {
  const raw = JSON.parse(jsonStr) as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v.length > 0 ? v : fallback;
  const scoreRaw = raw.score;
  let score = "0/850";
  if (typeof scoreRaw === "string" && scoreRaw.length > 0) score = scoreRaw;
  else if (typeof scoreRaw === "number") score = `${scoreRaw}/850`;
  return {
    country: str(raw.country, country),
    name: str(raw.name, "Unknown"),
    score,
    ageMonths: num(raw.ageMonths),
    cards: num(raw.cards),
    totalAccounts: num(raw.totalAccounts),
    utilization: str(raw.utilization, "0%"),
    delinquencies: num(raw.delinquencies),
    analysis: str(raw.analysis, ""),
    markdownSummary: str(raw.markdownSummary, ""),
  };
}

async function parseReportWithGemini(
  apiKey: string,
  reportText: string,
  country: string,
): Promise<ParsedProfile> {
  const fullPrompt = `${EXTRACTION_PROMPT}\n\nUser's country: ${country}\n\nCredit report:\n${reportText}`;
  const response = await callGemini(apiKey, fullPrompt, { responseJson: true });
  const jsonStr = extractJsonFromResponse(response);
  return parseExtractionPayload(jsonStr, country);
}

function parsedToSaved(p: ParsedProfile): SavedProfile {
  const parts = p.score.split("/").map(Number);
  const num = parts[0] ?? 0;
  const max = parts[1] ?? 850;
  return {
    country: p.country,
    name: p.name,
    score: p.score,
    scoreNum: num,
    scoreMax: max,
    ageMonths: p.ageMonths,
    cards: p.cards,
    totalAccounts: p.totalAccounts,
    utilization: p.utilization,
    delinquencies: p.delinquencies,
    timestamp: Date.now(),
  };
}

function computeGlobalScore(profiles: SavedProfile[]): number | null {
  if (profiles.length === 0) return null;
  const normalizedSum = profiles.reduce((sum, p) => sum + (p.scoreNum / p.scoreMax) * 850, 0);
  return Math.round(normalizedSum / profiles.length);
}

type ContractProfile = {
  country: string;
  name: string;
  score: string;
  ageMonths: bigint;
  cards: bigint;
  totalAccounts: bigint;
  utilization: string;
  delinquencies: bigint;
  ipfsCid?: string;
  timestamp: bigint;
};

function contractProfileToSaved(p: ContractProfile): SavedProfile {
  const parts = p.score.split("/").map(Number);
  const scoreNum = parts[0] ?? 0;
  const scoreMax = parts[1] ?? 850;
  return {
    country: p.country,
    name: p.name,
    score: p.score,
    scoreNum,
    scoreMax,
    ageMonths: Number(p.ageMonths),
    cards: Number(p.cards),
    totalAccounts: Number(p.totalAccounts),
    utilization: p.utilization,
    delinquencies: Number(p.delinquencies),
    timestamp: Number(p.timestamp),
    ipfsCid: p.ipfsCid,
  };
}

export default function PassportPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { targetNetwork } = useTargetNetwork();
  const [reportText, setReportText] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>(COUNTRIES[0].value);
  const [parsedResult, setParsedResult] = useState<ParsedProfile | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [parseElapsedSeconds, setParseElapsedSeconds] = useState(0);

  const { data: contractProfiles } = useScaffoldReadContract({
    contractName: "CreditPassport",
    functionName: "getProfiles",
    args: [address] as readonly [string | undefined],
  });

  const profiles: SavedProfile[] = useMemo(() => {
    if (!contractProfiles || !Array.isArray(contractProfiles)) return [];
    return (contractProfiles as ContractProfile[]).map(contractProfileToSaved);
  }, [contractProfiles]);

  const { writeContractAsync: addProfileToContract, isPending: isAddProfilePending } =
    useScaffoldWriteContract({
      contractName: "CreditPassport",
    });
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [geminiDebugPrompt, setGeminiDebugPrompt] = useState(
    "Explain how AI works in a few words",
  );
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedProfileKey, setExpandedProfileKey] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (!parseLoading) {
      setParseElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const intervalId = setInterval(() => {
      setParseElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [parseLoading]);

  const uploadProfileToPinata = async (profile: ParsedProfile & { address?: string | null }) => {
    const payload = {
      country: profile.country,
      name: profile.name,
      score: profile.score,
      ageMonths: profile.ageMonths,
      cards: profile.cards,
      totalAccounts: profile.totalAccounts,
      utilization: profile.utilization,
      delinquencies: profile.delinquencies,
      analysis: profile.analysis,
      markdownSummary: profile.markdownSummary,
      userAddress: profile.address ?? undefined,
      createdAt: new Date().toISOString(),
    };

    const res = await fetch("/api/pinata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata upload failed: ${text}`);
    }

    const data = (await res.json()) as { cid?: string };
    if (!data.cid) {
      throw new Error("Pinata upload response missing cid");
    }

    return data.cid;
  };

  const handleGeminiDebug = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setGeminiResult("Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local");
      return;
    }
    const prompt = geminiDebugPrompt.trim() || "Say hello in one sentence.";
    setGeminiLoading(true);
    setGeminiResult(null);
    try {
      const text = await callGemini(apiKey, prompt);
      setGeminiResult(text);
    } catch (e) {
      setGeminiResult(`Request failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleParse = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      toast.error("Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local to parse reports.");
      return;
    }
    if (!reportText.trim()) {
      toast.error("Paste your credit report text first.");
      return;
    }
    setParseLoading(true);
    setParseError(null);
    setParsedResult(null);
    try {
      const parsed = await parseReportWithGemini(apiKey, reportText.trim(), selectedCountry);
      setParsedResult(parsed);
      toast.success("Report parsed.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseError(msg);
      toast.error("Parse failed: " + msg);
    } finally {
      setParseLoading(false);
    }
  };

  const handleCancel = () => {
    setReportText("");
    setParsedResult(null);
    setSelectedCountry(COUNTRIES[0].value);
  };

  const handleConfirm = async () => {
    if (!parsedResult) return;

    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    try {
      setConfirmLoading(true);
      const cid = await uploadProfileToPinata({ ...parsedResult, address });
      await (addProfileToContract as any)({
        functionName: "addProfile",
        args: [
          parsedResult.country,
          parsedResult.name,
          parsedResult.score,
          BigInt(parsedResult.ageMonths),
          BigInt(parsedResult.cards),
          BigInt(parsedResult.totalAccounts),
          parsedResult.utilization,
          BigInt(parsedResult.delinquencies),
          cid,
        ],
      });
      toast.success("Credit profile saved on-chain.");
      handleCancel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    }
    finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-base-200 via-base-200 to-base-300/80">
      {parseLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/70 backdrop-blur">
          <div className="card bg-base-100 shadow-2xl rounded-2xl border border-base-300/60 w-full max-w-md mx-4 animate-fade-in">
            <div className="card-body p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="loading loading-spinner loading-md text-primary" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
                    Parsing credit report
                  </p>
                  <p className="text-base text-base-content">
                    This will take ~30 seconds. Please keep this tab open.
                  </p>
                </div>
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-base-content/70">
                  <span className="font-semibold text-primary">
                    {parseElapsedSeconds < 10
                      ? "Parsing score…"
                      : parseElapsedSeconds < 20
                      ? "Parsing history…"
                      : "Parsing cards & accounts…"}
                  </span>
                </p>
                <ul className="text-xs sm:text-sm space-y-1 text-base-content/70">
                  <li>
                    <span className={parseElapsedSeconds >= 5 ? "text-success font-medium" : ""}>
                      • Score & risk profile
                    </span>
                  </li>
                  <li>
                    <span className={parseElapsedSeconds >= 15 ? "text-success font-medium" : ""}>
                      • Credit history & delinquencies
                    </span>
                  </li>
                  <li>
                    <span className={parseElapsedSeconds >= 25 ? "text-success font-medium" : ""}>
                      • Cards, accounts & utilization
                    </span>
                  </li>
                </ul>
              </div>
              <div className="mt-2 text-xs text-base-content/60">
                Elapsed time:{" "}
                <span className="font-mono font-semibold text-base-content">
                  {parseElapsedSeconds.toString().padStart(2, "0")}s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Hero */}
        <header className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-base-content">
            Global Credit Passport
          </h1>
          <p className="mt-2 text-base sm:text-lg text-base-content/70 max-w-md mx-auto">
            One score across borders. Add your credit reports and build a portable, on-chain profile.
          </p>
        </header>

        {!isConnected ? (
          <div className="flex flex-col items-center">
            <div className="card bg-base-100 rounded-2xl shadow-xl border border-base-300/50 w-full max-w-md overflow-hidden">
              <div className="card-body p-8 sm:p-10 text-center">
                <p className="text-base-content/80 text-lg">
                  Connect your wallet to manage your global credit profile on-chain.
                </p>
                <div className="mt-6">
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) => (
                      <button
                        className="btn btn-primary btn-lg rounded-xl px-8 shadow-lg hover:shadow-xl transition-shadow"
                        onClick={openConnectModal}
                        type="button"
                        disabled={!mounted}
                      >
                        Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Global score + wallet */}
            {profiles.length > 0 && (
              <div className="card bg-base-100 rounded-2xl shadow-lg border border-base-300/40 overflow-hidden border-l-4 border-l-primary">
                <div className="card-body p-6 sm:p-8">
                  <p className="text-sm font-medium text-base-content/60 uppercase tracking-wider">
                    Your global score
                  </p>
                  <p className="text-4xl sm:text-5xl font-bold text-primary mt-1">
                    {computeGlobalScore(profiles)}
                  </p>
                  <p className="text-sm text-base-content/60 mt-1">Normalized from all linked reports</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-sm text-base-content/60">
              <span>Your wallet</span>
              <Address
                address={address}
                chain={targetNetwork}
                blockExplorerAddressLink={
                  targetNetwork.id === hardhat.id && address ? `/blockexplorer/address/${address}` : undefined
                }
              />
            </div>

            {/* Add credit report */}
            <section className="card bg-base-100 rounded-2xl shadow-lg border border-base-300/40 overflow-hidden">
              <div className="card-body p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-base-content">Add a credit report</h2>
                <p className="text-sm text-base-content/60 mt-0.5">
                  Paste your report below and choose the country. We’ll extract the key details.
                </p>
                <label className="form-control w-full mt-4">
                  <span className="label-text font-medium text-base-content/80">Paste your credit report</span>
                  <textarea
                    className="textarea textarea-bordered w-full min-h-[140px] rounded-xl mt-1.5 text-base"
                    placeholder="Paste your credit report here (Canada, US, Mexico, EU, Asia…)"
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    rows={6}
                  />
                </label>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <label className="form-control flex-1">
                    <span className="label-text font-medium text-base-content/80">Country</span>
                    <select
                      className="select select-bordered w-full rounded-xl mt-1.5"
                      value={selectedCountry}
                      onChange={e => setSelectedCountry(e.target.value)}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="btn btn-primary w-full sm:w-auto rounded-xl px-6 shadow-md"
                      onClick={handleParse}
                      disabled={parseLoading}
                    >
                      {parseLoading ? "Parsing…" : "Parse report"}
                    </button>
                  </div>
                </div>
                {parseError && (
                  <p className="text-error text-sm mt-2 bg-error/10 rounded-lg px-3 py-2">{parseError}</p>
                )}

                {parsedResult && (
                  <>
                    <div className="mt-6 p-5 bg-base-200/80 rounded-xl border border-base-300/50">
                      <p className="text-sm font-semibold text-base-content/80 mb-3">Parsed profile</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <span className="text-base-content/60">Country</span>
                        <span className="font-medium">{parsedResult.country}</span>
                        <span className="text-base-content/60">Name</span>
                        <span className="font-medium">{parsedResult.name}</span>
                        <span className="text-base-content/60">Score</span>
                        <span className="font-medium">{parsedResult.score}</span>
                        <span className="text-base-content/60">History</span>
                        <span className="font-medium">{parsedResult.ageMonths} months</span>
                        <span className="text-base-content/60">Cards</span>
                        <span className="font-medium">{parsedResult.cards}</span>
                        <span className="text-base-content/60">Total accounts</span>
                        <span className="font-medium">{parsedResult.totalAccounts}</span>
                        <span className="text-base-content/60">Utilization</span>
                        <span className="font-medium">{parsedResult.utilization}</span>
                        <span className="text-base-content/60">Delinquencies</span>
                        <span className="font-medium">{parsedResult.delinquencies}</span>
                      </div>
                      {(parsedResult.analysis || parsedResult.markdownSummary) && (
                        <div className="mt-5 space-y-3">
                          {parsedResult.analysis && (
                            <div>
                              <p className="text-sm font-semibold text-base-content/80 mb-1.5">
                                AI analysis
                              </p>
                              <p className="text-sm text-base-content/80 whitespace-pre-line">
                                {parsedResult.analysis}
                              </p>
                            </div>
                          )}
                          {parsedResult.markdownSummary && (
                            <div>
                              <p className="text-sm font-semibold text-base-content/80 mb-1.5">
                                Credit report summary
                              </p>
                              <div className="bg-base-100 rounded-xl border border-base-300/60 p-3 text-sm">
                                <ReactMarkdown>{parsedResult.markdownSummary}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 mt-5">
                        <button
                          type="button"
                          className="btn btn-ghost rounded-xl"
                          onClick={handleCancel}
                          disabled={isAddProfilePending || confirmLoading}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary rounded-xl shadow-md"
                          onClick={handleConfirm}
                          disabled={isAddProfilePending || confirmLoading}
                        >
                          {isAddProfilePending || confirmLoading ? "Saving…" : "Confirm & save on-chain"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Your profiles */}
            <section>
              <h2 className="text-xl font-semibold text-base-content mb-4">Your credit profiles</h2>
              {profiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 bg-base-100/50 py-10 px-6 text-center">
                  <p className="text-base-content/60 text-sm">
                    No profiles yet. Add a credit report above and save it on-chain to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profiles.map((p, i) => {
                    const key = `${p.country}-${p.timestamp}-${i}`;
                    const isExpanded = expandedProfileKey === key;
                    return (
                      <div
                        key={key}
                        className="card bg-base-100 rounded-2xl shadow-md border border-base-300/40 overflow-hidden transition-all hover:shadow-lg"
                      >
                        <button
                          type="button"
                          className="text-left w-full p-4 sm:p-5 flex items-center gap-3 min-w-0"
                          onClick={() => setExpandedProfileKey(isExpanded ? null : key)}
                        >
                          <span className="font-medium text-base-content truncate min-w-0">
                            {COUNTRY_FLAGS[p.country] ?? ""} {p.country} · {p.score}
                          </span>
                          <span className="text-base-content/50 text-sm shrink-0 hidden sm:inline">
                            {p.ageMonths}mo · {p.cards} cards
                          </span>
                          <span className="text-base-content/40 text-sm shrink-0 ml-auto">
                            {isExpanded ? "▲ Less" : "▼ More"}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-base-300/50">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pt-4">
                              <span className="text-base-content/60">Country</span>
                              <span className="font-medium">{p.country}</span>
                              <span className="text-base-content/60">Name</span>
                              <span className="font-medium">{p.name ?? "—"}</span>
                              <span className="text-base-content/60">Score</span>
                              <span className="font-medium">{p.score}</span>
                              <span className="text-base-content/60">History</span>
                              <span className="font-medium">{p.ageMonths} months</span>
                              <span className="text-base-content/60">Cards</span>
                              <span className="font-medium">{p.cards}</span>
                              <span className="text-base-content/60">Total accounts</span>
                              <span className="font-medium">{p.totalAccounts ?? "—"}</span>
                              <span className="text-base-content/60">Utilization</span>
                              <span className="font-medium">{p.utilization}</span>
                              <span className="text-base-content/60">Delinquencies</span>
                              <span className="font-medium">{p.delinquencies ?? "—"}</span>
                              {p.ipfsCid && (
                                <>
                                  <span className="text-base-content/60">IPFS</span>
                                  <span className="font-medium break-all">
                                    <a
                                      href={`${PINATA_GATEWAY_BASE}${p.ipfsCid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="link link-primary"
                                    >
                                      {p.ipfsCid}
                                    </a>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Developer: Gemini debug (collapsible) */}
            <details
              className="group card bg-base-100/60 rounded-2xl border border-base-300/40 overflow-hidden [&::-webkit-details-marker]:hidden"
              open={debugOpen}
              onToggle={e => setDebugOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="list-none cursor-pointer p-4 sm:p-5 font-medium text-base-content/80 hover:text-base-content [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  Developer · Gemini debug
                  <span className="text-base-content/40 text-sm font-normal">(custom prompt)</span>
                </span>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-3">
                <input
                  type="text"
                  className="input input-bordered w-full rounded-xl"
                  placeholder="e.g. Explain how AI works in a few words"
                  value={geminiDebugPrompt}
                  onChange={e => setGeminiDebugPrompt(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm rounded-xl"
                  onClick={handleGeminiDebug}
                  disabled={geminiLoading}
                >
                  {geminiLoading ? "…" : "Send to Gemini"}
                </button>
                {geminiResult != null && (
                  <pre className="p-4 bg-base-200 rounded-xl text-sm overflow-auto whitespace-pre-wrap border border-base-300/50">
                    {geminiResult}
                  </pre>
                )}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}