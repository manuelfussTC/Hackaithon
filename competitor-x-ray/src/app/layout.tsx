import type { Metadata } from "next";
import "@fontsource-variable/archivo";
import "@fontsource/archivo-black";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor X-Ray | K5 Hackathon",
  description: "Zwei Produktdetailseiten im evidenzbasierten Wettbewerbsvergleich.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body suppressHydrationWarning>{children}</body></html>;
}
