"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { GlobeAltIcon, CreditCardIcon } from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5 max-w-2xl mx-auto text-center">
        <h1 className="text-center">
          <span className="block text-2xl mb-2">Welcome to</span>
          <span className="block text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Global Credit Passport
          </span>
        </h1>
        <p className="text-base-content/80 text-lg mt-4">
          One score across borders. Build a portable, on-chain credit profile and apply for credit using your global
          history.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
          <Link
            href="/passport"
            className="btn btn-primary gap-2 rounded-xl px-8 py-4 text-lg shadow-lg"
          >
            <GlobeAltIcon className="h-6 w-6" />
            Credit Passport
          </Link>
          <Link
            href="/card-application"
            className="btn btn-outline gap-2 rounded-xl px-8 py-4 text-lg border-2"
          >
            <CreditCardIcon className="h-6 w-6" />
            Apply for Card
          </Link>
        </div>

        <p className="text-base-content/60 text-sm mt-8">
          Add credit reports from multiple countries, get a global normalized score, and apply for the Deutsche
          Premium Kreditkarte with your global credit history or SCHUFA.
        </p>
      </div>
    </div>
  );
};

export default Home;
