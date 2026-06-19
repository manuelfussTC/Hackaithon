import type { Metadata } from "next";
import "@fontsource-variable/archivo";
import "@fontsource/archivo-black";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDP → Growth Kit | K5 Hackathon",
  description: "Von der Produktdetailseite zum vollständigen Marketingpaket.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body suppressHydrationWarning>{children}</body></html>;
}
