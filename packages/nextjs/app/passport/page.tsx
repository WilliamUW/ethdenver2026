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

function fakeParseReport(_rawText: string, country: string): ParsedProfile {
  return {
    country,
    name: "John Doe",
    score: "720/900",
    ageMonths: 24,
    cards: 3,
    utilization: "28%",
    delinquencies: 0,
  };
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

  const handleParse = () => {
    setParsedResult(fakeParseReport(reportText, selectedCountry));
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
                  <button type="button" className="btn btn-primary" onClick={handleParse}>
                    Parse Report
                  </button>
                </div>
              </div>

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
