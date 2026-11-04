import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TAXATION SMART · Project Management",
  description: "Dashboard de seguimiento del proyecto TAXATION SMART — Gobernación de Antioquia · Informática y Tributos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
