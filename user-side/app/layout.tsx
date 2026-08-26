import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rubber Panel", template: "%s | Rubber Panel" },
  description: "Rubber Panel — Server Management by Flaxa Studios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
