"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export default function PassportPage() {
  const { address, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();

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
            <div className="flex justify-center items-center flex-col gap-2">
              <p className="font-medium">Connected Address:</p>
              <Address
                address={address}
                chain={targetNetwork}
                blockExplorerAddressLink={
                  targetNetwork.id === hardhat.id && address ? `/blockexplorer/address/${address}` : undefined
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
