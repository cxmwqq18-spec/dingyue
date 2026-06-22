import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Subscription Platform",
  description: "Multi-site AI subscription platform with store-style theme designer.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23171717'/%3E%3Cpath d='M8 21.5 16 6l8 15.5h-4.4l-1.4-3H13.8l-1.4 3H8Zm7.1-6.5h1.8L16 13l-.9 2Z' fill='%23f7f4ee'/%3E%3C/svg%3E"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
