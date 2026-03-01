import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, optimism } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "CrisisVault",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [base, optimism],
  ssr: false,
});
