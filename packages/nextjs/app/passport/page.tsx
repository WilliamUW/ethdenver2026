"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

const COUNTRIES = [
  { value: "Auto", label: "Auto (detect from report)" },
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

// Sample report templates are provided via public env vars so they can be updated without code changes.
// Set these in `.env.local`, for example:
// NEXT_PUBLIC_SAMPLE_CANADA_REPORT="...full Canada report text..."
// NEXT_PUBLIC_SAMPLE_US_REPORT="...full US report text..."
const SAMPLE_CANADA_REPORT = `17/02/2026
16/07/2020
$0
Open
$0
$4,000
$0
Paid as agreed and up to date.
Revolving - open/end account
January 22, 2026
September 3, 2023
Your Equifax® Credit Report and Score
Credit Score Summary
740Date Credit Report Last Pulled:
File Creation Date:
Personal Information
Name: Chen Ye Wang
Date of Birth: 2002-05-XX
Address: 19 Glen Springs
Drive T oronto,
Ontario M1W
1X7
Trades/Accounts
Accounts refer to any open or closed accounts that appear on your credit report such as credit cards, instalment loans,
mortgages and mobile phone accounts.
REVOLVING
ROGERS BANK
Reported: January 26, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
$0
Open
$0
$3,500
$0
Paid as agreed and up to date.
Revolving - open/end account
January 12, 2026
April 22, 2021
$241
Open
$241
$2,500
$0
Paid as agreed and up to date.
Revolving - open/end account
December 21, 2025
March 7, 2024
$0
Open
$0
$20,000
$0
Paid as agreed and up to date.
Revolving - open/end account
January 7, 2025
September 10, 2024
TD CREDIT CARDS
Reported: January 20, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
CIBC CARD SERVICES
Reported: February 7, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
AMERICAN EXPRESS
Reported: February 10, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
$0
Open
$0
$2,800
$0
Paid as agreed and up to date.
Revolving - open/end account
September 10, 2024
July 16, 2020
$0
Open
$0
$9,000
$0
Paid as agreed and up to date.
Revolving - open/end account
October 4, 2023
September 14, 2023
$0
Closed
$0
$2,500
$0
Paid as agreed and up to date.
Revolving - open/end account
January 3, 2022
December 15, 2021
BMO CREDIT CARD
Reported: February 12, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
TANGERINE
Reported: January 28, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
PRESIDENTS CHOICE MC
Reported: August 8, 2022
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
$0
Open
$0
$2,500
$0
Paid as agreed and up to date.
Revolving - open/end account
August 1, 2024
$27,279
Open
$27,279
$30,220
$0
Paid as agreed and up to date.
Instalment - fixed number of payments
February 2, 2026
September 8, 2020
$0
Closed
$0
$16,280
$0
Paid as agreed and up to date.
Instalment - fixed number of payments
March 12, 2025
March 17, 2021
MBNA
Reported: January 23, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
INSTALMENT
CDA STUDENT LOANS PR
Reported: February 4, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
TOYOTA CREDIT CANADA
Reported: January 30, 2026
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
$0
Closed
$0
$53,964
$0
Paid as agreed and up to date.
Instalment - fixed number of payments
April 18, 2024
January 16, 2023
$0
Closed
$0
$0
$0
Paid as agreed and up to date.
Open Account - 30, 60 or 90 day account
October 10, 2024
November 26, 2022
$0
Closed
$0
$0
$0
Paid as agreed and up to date.
Open Account - 30, 60 or 90 day account
December 8, 2023
December 23, 2021
TDCT
Reported: April 30, 2024
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
OPEN
FIDO
Reported: October 29, 2024
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
FIDO
Reported: December 27, 2023
Overview
Balance
High Credit
Past Due Amount
Account Details
Payment Details
Type
Last Activity
Open Date
MORTGAGE
There are no mortgage accounts listed on your credit report.
Credit Inquiries
Credit inquiries are requests to check your credit.
"Hard inquiries" occur when a potential lender is reviewing your credit
because you've applied for credit with them, and may affect your credit score.
"Soft inquiries" occur when you're checking
your own credit file and/or score (such as checking your score with Borrowell), credit checks made by businesses to offer
you a quote, or inquiries made by businesses where you already have an account.
"Soft inquiries" do not affect your credit
score.
LOCAL INQUIRIES
FREEDOM MOBILE
Reported: December 18 2024
FREEDOM MOBILE
Reported: October 23 2024
FOREIGN INQUIRIES
Reported: November 16 2023
Collections
Any accounts that have been sent to collections, whether the balance(s) have been paid or unpaid. Be careful – when an
account gets sent to collections it can have a big impact on your credit score.
COLLECTIONS
There are no collections listed on your credit report.
Legal Items
Any public records on your credit report. This may include items such as a court judgment.
LEGAL ITEMS
There are no legal items listed on your credit report.
Bankruptcies
If you have ever filed for bankruptcy or consumer proposal it would appear here.
BANKRUPTCIES
There are no bankruptcies listed on your credit report.
Equifax Canada Co. (“Equifax”) is a registered Canadian credit bureau that maintains your Canadian consumer
credit file, which has been used by Borrowell Inc. as permitted by you, to provide you with your educational
Equifax Consumer Credit Report. The Equifax Consumer Credit Report provided here is current as of the date
indicated on your report. For a full copy of your up to date Equifax credit file, please contact Equifax directly.
Equifax® and the Powered by Equifax Logo are registered trademarks of Equifax Canada Co. used under
License.`;
const SAMPLE_US_REPORT = `You have good credit.
Vantage 3.0® credit score
With a score between 720–780, y
ou may qualify for credit cards and loans at competitive rates.
Refer to get $15 in rewards points
Get the SoFi app to redeem your rewards and get
alerts on your credit score.
Credit factors
Credit utilization 0%
Payment history 100%
Average age of credit 11 mos
Total accounts 9
Inquiries 7
Derogatory marks 0
Score history
Credit Score
735
Updated Feb 14
300 600 657 719 780 850
3M 6M 1Y
Spot an error?
If y
ou see an error or want to dispute something on
y
our credit report, please contact TransUnion®
Go to TransUnion®
650
700
750
800
850
735
February
14th, 2026
Privacy & Security Terms of Use Disclaimers Licenses NMLS Access Eligibility Criteria
SoFi's Insights tool offers users the ability to connect both SoFi accounts and external accounts using Plaid, Inc.
's service. When you use the service
to connect an account, you authorize SoFi to obtain account information from any external accounts as set forth in SoFi's Terms of Use. SoFi assumes
no responsibility for the timeliness, accuracy, deletion, non-delivery or failure to store any user data, loss of user data, communications, or
personalization settings. You shall confirm the accuracy of Plaid data through sources independent of SoFi. The credit score provided to you is a
VantageScore based on TransUnion (the "Processing Agent") data.
Investment and Insurance Products:
Not FDIC Insured Not Bank Guaranteed May Lose Value
Brokerage and Active investing products offered through SoFi Securities LLC, member FINRA/SIPC.
Automated Investing and Advisory services offered by SoFi Wealth LLC, an SEC-registered investment adviser.
SoFi Checking and Savings is offered through SoFi Bank, N.A. Member FDIC.
See disclaimers
® ®
© 2026 Social Finance, Inc.
SSL Encrypted
Equal Housing ORT"`;

const EXTRACTION_PROMPT = `You are a credit report parser working for a conservative, regulated consumer lender. Read the credit report as a loan underwriter would and extract the following fields from the credit report text below. Return ONLY a valid JSON object with no other text, no markdown, no code fence. Use exactly these keys:
- country (string): if the user's selection is "Auto" or missing, infer the country from the report content. Always map well-known lenders explicitly as follows: any report mentioning Sofi or SoFi should be treated as USA; any report mentioning Borrowell should be treated as Canada. For other cases, infer the country from issuer names, bureaus, and terminology when reasonably clear; otherwise use the country provided by the user, or null if none is given.
- name (string): account holder name if present, else "Unknown"
- score (string): credit score, format like "720/850" or "680/900" (score/max). If only one number given, use that number and common max for that country (e.g. 850 USA, 900 Canada)
- ageMonths (number): length of credit history in months, or 0 if unknown
- cards (number): number of credit cards or revolving accounts
- totalAccounts (number): total number of credit accounts (cards, loans, etc.)
- utilization (string): credit utilization as percentage, e.g. "28%"
- delinquencies (number): number of late payments or delinquencies, 0 if none/none mentioned
- analysis (string): a SHORT AI analysis paragraph (3–5 sentences maximum) that neutrally describes the user's overall creditworthiness. Focus on the main strengths and the primary risk factors (for example, high credit utilization, recent delinquencies, a very short credit history, or frequent new inquiries). Use clear, plain language, describe risks in concrete terms (for example, "the user's credit utilization may pose a concern"), and avoid lists, bullet points, advice, or recommendations for improvement in this field.
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

async function callGemini(apiKey: string, userPrompt: string, options?: { responseJson?: boolean }): Promise<string> {
  const body: {
    model: string;
    messages: Array<{ role: "user"; content: string }>;
    response_format?: { type: "json_object" | "text" };
  } = {
    model: "gpt-4.1-nano",
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
  const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
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

async function parseReportWithGemini(apiKey: string, reportText: string, country: string): Promise<ParsedProfile> {
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
  const normalizedSum = profiles.reduce((sum, p) => sum + (p.scoreNum / p.scoreMax) * 100, 0);
  return Math.round(normalizedSum / profiles.length);
}

function clampScore(score: number | null): number {
  if (score === null || Number.isNaN(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
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

  const globalScore = useMemo(() => computeGlobalScore(profiles), [profiles]);
  const clampedGlobalScore = useMemo(() => clampScore(globalScore), [globalScore]);

  const { writeContractAsync: addProfileToContract, isPending: isAddProfilePending } = useScaffoldWriteContract({
    contractName: "CreditPassport",
  });
  const { writeContractAsync: deleteProfilesFromContract, isPending: isDeleteProfilesPending } =
    useScaffoldWriteContract({
      contractName: "CreditPassport",
    });
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const [geminiDebugPrompt, setGeminiDebugPrompt] = useState("Explain how AI works in a few words");
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
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteAllProfiles = async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (profiles.length === 0) {
      toast("You don't have any profiles to delete.");
      return;
    }
    try {
      await deleteProfilesFromContract({
        functionName: "deleteMyProfiles",
        args: [],
      } as any);
      toast.success("All credit profiles deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete profiles");
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      {parseLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur">
          <div className="card bg-white/10 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 w-full max-w-md mx-4 animate-fade-in">
            <div className="card-body p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="loading loading-spinner loading-md text-indigo-400" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
                    Parsing credit report
                  </p>
                  <p className="text-base text-white">This will take ~30 seconds. Please keep this tab open.</p>
                </div>
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-white/80">
                  <span className="font-semibold text-indigo-300">
                    {parseElapsedSeconds < 10
                      ? "Parsing score…"
                      : parseElapsedSeconds < 20
                        ? "Parsing history…"
                        : "Parsing cards & accounts…"}
                  </span>
                </p>
                <ul className="text-xs sm:text-sm space-y-1 text-white/70">
                  <li>
                    <span className={parseElapsedSeconds >= 5 ? "text-green-400 font-medium" : ""}>
                      • Score & risk profile
                    </span>
                  </li>
                  <li>
                    <span className={parseElapsedSeconds >= 15 ? "text-green-400 font-medium" : ""}>
                      • Credit history & delinquencies
                    </span>
                  </li>
                  <li>
                    <span className={parseElapsedSeconds >= 25 ? "text-green-400 font-medium" : ""}>
                      • Cards, accounts & utilization
                    </span>
                  </li>
                </ul>
              </div>
              <div className="mt-2 text-xs text-white/60">
                Elapsed time:{" "}
                <span className="font-mono font-semibold text-white">
                  {parseElapsedSeconds.toString().padStart(2, "0")}s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {(confirmLoading || isAddProfilePending) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
          <div className="card bg-white/10 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 w-full max-w-md mx-4 animate-fade-in">
            <div className="card-body p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="loading loading-spinner loading-md text-indigo-400" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
                    Confirming on-chain
                  </p>
                  <p className="text-base text-white">
                    This will take around 10 seconds while we save your profile to Pinata and confirm the transaction on-chain.
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/60">
                Please keep this tab open and avoid closing your wallet until the confirmation completes.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">Global Credit Passport</h1>
          <p className="mt-2 text-lg sm:text-xl text-indigo-200 max-w-2xl mx-auto">
            One score across borders. Add your credit reports and build a portable, on-chain profile.
          </p>
        </header>

        {!isConnected ? (
          <div className="flex flex-col items-center">
            <div className="card bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 w-full max-w-md overflow-hidden">
              <div className="card-body p-8 sm:p-10 text-center">
                <div className="text-6xl mb-4">🌍</div>
                <p className="text-white text-lg mb-6">
                  Connect your wallet to manage your global credit profile on-chain.
                </p>
                <div className="mt-6">
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) => (
                      <button
                        className="btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white btn-lg rounded-xl px-8 shadow-lg hover:shadow-xl transition-all border-0"
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
            {profiles.length > 0 && globalScore !== null && (
              <div className="card bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
                <div className="card-body p-6 sm:p-8">
                  <p className="text-sm font-medium text-indigo-200 uppercase tracking-wider mb-6">
                    Your global normalized score (0–100)
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              "conic-gradient(#22c55e 0deg, #22c55e 72deg, #a3e635 72deg, #a3e635 144deg, #facc15 144deg, #facc15 216deg, #f97316 216deg, #f97316 288deg, #ef4444 288deg, #ef4444 360deg)",
                          }}
                        />
                        <div className="absolute inset-3 rounded-full bg-slate-900" />
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            transform: `rotate(${(clampedGlobalScore / 100) * 360 - 90}deg)`,
                          }}
                        >
                          <div className="w-0.5 sm:w-[3px] h-12 sm:h-16 bg-white rounded-full origin-bottom translate-y-2" />
                          <div className="absolute w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-white" />
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-3 w-full max-w-xs px-1 text-[0.65rem] text-white/70">
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-error/80" />
                          <span>0–19</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                          <span>20–39</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                          <span>40–59</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-lime-300" />
                          <span>60–79</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span>80–100</span>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-col items-center text-white">
                        <span className="text-2xl sm:text-3xl font-bold">{globalScore}</span>
                        <span className="text-[0.65rem] sm:text-xs text-white/60">out of 100</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-white/90">
                        This is your <span className="font-semibold text-indigo-300">global normalized credit score</span>, on a simple
                        0–100 scale.
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-[0.8rem]">
                        <span className="font-medium text-red-400">0–39 · Higher risk</span>
                        <span className="font-medium text-amber-400">40–59 · Fair</span>
                        <span className="font-medium text-lime-400">60–79 · Good</span>
                        <span className="font-medium text-emerald-400">80–100 · Excellent</span>
                      </div>
                      <p className="text-[0.7rem] text-white/60 leading-relaxed">
                        Traditional credit bureaus use different maximum scores (for example 850 or 900). To compare
                        reports from many countries, we rescale each underlying score to a common 0–100 range and then
                        average them. The 100-point cap is an arbitrary normalization so this number should be treated
                        as an aggregated indicator, not a bureau-issued score.
                      </p>
                    </div>
                  </div>
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
                {parseError && <p className="text-error text-sm mt-2 bg-error/10 rounded-lg px-3 py-2">{parseError}</p>}

                {parsedResult && (
                  <>
                    <div className="mt-6 p-6 bg-slate-800/95 backdrop-blur-lg rounded-2xl border border-slate-600/50 shadow-xl">
                      <p className="text-lg font-bold text-white mb-4">Parsed profile</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-6">
                        <span className="text-slate-300">Country</span>
                        <span className="font-medium text-white">{parsedResult.country}</span>
                        <span className="text-slate-300">Name</span>
                        <span className="font-medium text-white">{parsedResult.name}</span>
                        <span className="text-slate-300">Score</span>
                        <span className="font-medium text-white">{parsedResult.score}</span>
                        <span className="text-slate-300">History</span>
                        <span className="font-medium text-white">{parsedResult.ageMonths} months</span>
                        <span className="text-slate-300">Cards</span>
                        <span className="font-medium text-white">{parsedResult.cards}</span>
                        <span className="text-slate-300">Total accounts</span>
                        <span className="font-medium text-white">{parsedResult.totalAccounts}</span>
                        <span className="text-slate-300">Utilization</span>
                        <span className="font-medium text-white">{parsedResult.utilization}</span>
                        <span className="text-slate-300">Delinquencies</span>
                        <span className="font-medium text-white">{parsedResult.delinquencies}</span>
                      </div>
                      {(parsedResult.analysis || parsedResult.markdownSummary) && (
                        <div className="mt-5 space-y-4">
                          {parsedResult.analysis && (
                            <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">AI analysis</p>
                              <p className="text-sm text-slate-200 whitespace-pre-line bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                                {parsedResult.analysis}
                              </p>
                            </div>
                          )}
                          {parsedResult.markdownSummary && (
                            <div>
                              <p className="text-sm font-semibold text-slate-300 mb-2">Credit report summary</p>
                              <div className="bg-slate-700/50 rounded-xl border border-slate-600/50 p-4 text-sm text-slate-200 [&_*]:text-slate-200">
                                <ReactMarkdown>{parsedResult.markdownSummary}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 mt-6">
                        <button
                          type="button"
                          className="btn bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl"
                          onClick={handleCancel}
                          disabled={isAddProfilePending || confirmLoading}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg border-0"
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
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-2xl font-bold text-white">Your credit profiles</h2>
                {profiles.length > 0 && (
                  <button
                    type="button"
                    className="btn bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 btn-sm rounded-xl"
                    onClick={handleDeleteAllProfiles}
                    disabled={isDeleteProfilesPending || parseLoading || confirmLoading || isAddProfilePending}
                  >
                    {isDeleteProfilesPending ? "Deleting…" : "Delete all"}
                  </button>
                )}
              </div>
              {profiles.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-lg py-16 px-6 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-white/70 text-lg">
                    No profiles yet. Add a credit report above and save it on-chain to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profiles.map((p, i) => {
                    const key = `${p.country}-${p.timestamp}-${i}`;
                    const isExpanded = expandedProfileKey === key;
                    const scoreParts = p.score.split('/');
                    const scoreNum = parseInt(scoreParts[0] || '0');
                    return (
                      <div
                        key={key}
                        className="card bg-white/10 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20 overflow-hidden transition-all hover:border-white/40 hover:shadow-xl"
                      >
                        <button
                          type="button"
                          className="text-left w-full p-5 flex items-center gap-4 min-w-0"
                          onClick={() => setExpandedProfileKey(isExpanded ? null : key)}
                        >
                          <div className="text-3xl">{COUNTRY_FLAGS[p.country] ?? "🌍"}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-lg truncate">
                              {p.country} · {p.score}
                            </div>
                            <div className="text-indigo-200 text-sm">
                              {p.ageMonths}mo · {p.cards} cards · {p.totalAccounts} accounts
                            </div>
                          </div>
                          <div className="text-white/40 text-sm shrink-0">
                            {isExpanded ? "▲ Less" : "▼ More"}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-0 border-t border-white/10">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm pt-5">
                              <span className="text-indigo-200">Country</span>
                              <span className="font-medium text-white">{p.country}</span>
                              <span className="text-indigo-200">Name</span>
                              <span className="font-medium text-white">{p.name ?? "—"}</span>
                              <span className="text-indigo-200">Score</span>
                              <span className="font-medium text-white">{p.score}</span>
                              <span className="text-indigo-200">History</span>
                              <span className="font-medium text-white">{p.ageMonths} months</span>
                              <span className="text-indigo-200">Cards</span>
                              <span className="font-medium text-white">{p.cards}</span>
                              <span className="text-indigo-200">Total accounts</span>
                              <span className="font-medium text-white">{p.totalAccounts ?? "—"}</span>
                              <span className="text-indigo-200">Utilization</span>
                              <span className="font-medium text-white">{p.utilization}</span>
                              <span className="text-indigo-200">Delinquencies</span>
                              <span className="font-medium text-white">{p.delinquencies ?? "—"}</span>
                              {p.ipfsCid && (
                                <>
                                  <span className="text-indigo-200">IPFS</span>
                                  <span className="font-medium break-all">
                                    <a
                                      href={`${PINATA_GATEWAY_BASE}${p.ipfsCid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-300 hover:text-indigo-200 underline"
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
              className="group card bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden [&::-webkit-details-marker]:hidden"
              open={debugOpen}
              onToggle={e => setDebugOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="list-none cursor-pointer p-4 sm:p-5 font-medium text-white/80 hover:text-white [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  Developer · Gemini debug
                  <span className="text-white/40 text-sm font-normal">(custom prompt)</span>
                </span>
              </summary>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-3">
                <input
                  type="text"
                  className="input bg-white/10 border-white/20 text-white placeholder-white/40 w-full rounded-xl"
                  placeholder="e.g. Explain how AI works in a few words"
                  value={geminiDebugPrompt}
                  onChange={e => setGeminiDebugPrompt(e.target.value)}
                />
                <button
                  type="button"
                  className="btn bg-indigo-600 hover:bg-indigo-700 text-white btn-sm rounded-xl border-0"
                  onClick={handleGeminiDebug}
                  disabled={geminiLoading}
                >
                  {geminiLoading ? "…" : "Send to Gemini"}
                </button>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="btn bg-white/10 hover:bg-white/20 text-white border-white/20 btn-xs rounded-xl"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(SAMPLE_CANADA_REPORT);
                        toast.success("Copied Canada sample report to clipboard.");
                      } catch {
                        toast.error("Failed to copy Canada sample report.");
                      }
                    }}
                  >
                    Copy Canada report
                  </button>
                  <button
                    type="button"
                    className="btn bg-white/10 hover:bg-white/20 text-white border-white/20 btn-xs rounded-xl"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(SAMPLE_US_REPORT);
                        toast.success("Copied US sample report to clipboard.");
                      } catch {
                        toast.error("Failed to copy US sample report.");
                      }
                    }}
                  >
                    Copy US report
                  </button>
                </div>
                {geminiResult != null && (
                  <pre className="p-4 bg-white/5 rounded-xl text-sm overflow-auto whitespace-pre-wrap border border-white/10 text-white/90">
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
