import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Enigmate Web",
  description: "Version web de l'application Enigmate inspirée de la landing page BrainTeaser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} min-h-screen bg-background text-foreground antialiased`}> 
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
