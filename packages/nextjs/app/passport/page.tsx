"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import toast from "react-hot-toast";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";


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
};

type SavedProfile = {
  country: string;
  score: string;
  scoreNum: number;
  scoreMax: number;
  ageMonths: number;
  cards: number;
  utilization: string;
  timestamp: number;
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

const EXTRACTION_PROMPT = `You are a credit report parser. Extract the following fields from the credit report text below and return ONLY a valid JSON object with no other text, no markdown, no code fence. Use exactly these keys:
- country (string): use the country provided by the user
- name (string): account holder name if present, else "Unknown"
- score (string): credit score, format like "720/850" or "680/900" (score/max). If only one number given, use that number and common max for that country (e.g. 850 USA, 900 Canada)
- ageMonths (number): length of credit history in months, or 0 if unknown
- cards (number): number of credit cards or revolving accounts
- totalAccounts (number): total number of credit accounts (cards, loans, etc.)
- utilization (string): credit utilization as percentage, e.g. "28%"
- delinquencies (number): number of late payments or delinquencies, 0 if none/none mentioned

If a value cannot be found, use null for that key. Return only the JSON object.`;

async function callGemini(
  apiKey: string,
  userPrompt: string,
  options?: { responseJson?: boolean },
): Promise<string> {
  const body: {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig?: { temperature: number; responseMimeType?: string };
  } = {
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: options?.responseJson ? 0.1 : 0.7 },
  };
  if (options?.responseJson) body.generationConfig!.responseMimeType = "application/json";

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${raw}`);
  const data = JSON.parse(raw) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? raw;
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
  const [num, max] = p.score.split("/").map(Number);
  return {
    country: p.country,
    score: p.score,
    scoreNum: num,
    scoreMax: max,
    ageMonths: p.ageMonths,
    cards: p.cards,
    utilization: p.utilization,
    timestamp: Date.now(),
  };
}

function computeGlobalScore(profiles: SavedProfile[]): number | null {
  if (profiles.length === 0) return null;
  const normalizedSum = profiles.reduce((sum, p) => sum + (p.scoreNum / p.scoreMax) * 850, 0);
  return Math.round(normalizedSum / profiles.length);
}

export default function PassportPage() {
  const { address, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const [reportText, setReportText] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>(COUNTRIES[0].value);
  const [parsedResult, setParsedResult] = useState<ParsedProfile | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [geminiDebugPrompt, setGeminiDebugPrompt] = useState(
    "Explain how AI works in a few words",
  );
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

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

  const handleConfirm = () => {
    if (!parsedResult) return;
    setProfiles(prev => [...prev, parsedToSaved(parsedResult)]);
    toast.success("Credit profile saved to your passport.");
    handleCancel();
  };

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 w-full max-w-4xl mx-auto">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <p className="text-lg font-medium">Connect your wallet to use Global Credit Passport</p>
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button className="btn btn-primary btn-lg" onClick={openConnectModal} type="button" disabled={!mounted}>
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : (
          <>
            <h1 className="text-center text-3xl font-bold mb-4">Global Credit Passport</h1>
            <div className="flex flex-col gap-2 mb-4 max-w-xl mx-auto">
              <label className="form-control w-full">
                <span className="label-text">Gemini debug — custom prompt</span>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Explain how AI works in a few words"
                  value={geminiDebugPrompt}
                  onChange={e => setGeminiDebugPrompt(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleGeminiDebug}
                disabled={geminiLoading}
              >
                {geminiLoading ? "..." : "Send to Gemini"}
              </button>
            </div>
            {geminiResult != null && (
              <pre className="mx-auto mb-6 max-w-xl p-4 bg-base-200 rounded-lg text-sm overflow-auto whitespace-pre-wrap">
                {geminiResult}
              </pre>
            )}
            {profiles.length > 0 && (
              <p className="text-center text-xl font-semibold mb-6">
                Global Credit Score: {computeGlobalScore(profiles)}
              </p>
            )}
            <div className="flex justify-center items-center flex-col gap-2 mb-8">
              <p className="font-medium">Connected Address:</p>
              <Address
                address={address}
                chain={targetNetwork}
                blockExplorerAddressLink={
                  targetNetwork.id === hardhat.id && address ? `/blockexplorer/address/${address}` : undefined
                }
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Upload credit score from countries</h2>
              <label className="form-control w-full">
                <span className="label-text">Paste your credit report</span>
                <textarea
                  className="textarea textarea-bordered w-full min-h-32"
                  placeholder="Paste your credit report here (Canada, US, Mexico, EU, Asia)"
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  rows={6}
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="form-control w-full max-w-xs">
                  <span className="label-text">Country</span>
                  <select
                    className="select select-bordered w-full"
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
                    className="btn btn-primary"
                    onClick={handleParse}
                    disabled={parseLoading}
                  >
                    {parseLoading ? "Parsing…" : "Parse Report"}
                  </button>
                </div>
              </div>
              {parseError && (
                <p className="text-error text-sm mt-1">{parseError}</p>
              )}

              {parsedResult && (
                <>
                  <div className="mt-6 p-4 bg-base-200 rounded-lg font-mono text-sm whitespace-pre">
                    Parsed Credit Profile:
                    {"\n"}
                    Country: {parsedResult.country}
                    {"\n"}
                    Name: {parsedResult.name}
                    {"\n"}
                    Score: {parsedResult.score}
                    {"\n"}
                    Age: {parsedResult.ageMonths} months
                    {"\n"}
                    Cards: {parsedResult.cards} active
                    {"\n"}
                    Total accounts: {parsedResult.totalAccounts}
                    {"\n"}
                    Utilization: {parsedResult.utilization}
                    {"\n"}
                    Delinquencies: {parsedResult.delinquencies}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirm}>
                      Confirm & Save to Profile
                    </button>
                  </div>
                </>
              )}
            </div>

            {profiles.length > 0 && (
              <div className="mt-10 space-y-3">
                <h2 className="text-xl font-semibold">Your Global Credit Profiles</h2>
                <ul className="space-y-2">
                  {profiles.map((p, i) => (
                    <li key={`${p.country}-${p.timestamp}-${i}`} className="p-3 bg-base-200 rounded-lg">
                      {COUNTRY_FLAGS[p.country] ?? ""} {p.country}: {p.score} ({p.ageMonths}mo, {p.cards} cards)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}