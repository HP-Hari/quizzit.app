import type { Metadata } from "next";
import { AuthProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quizzit — Interactive Quiz Platform",
  description: "Create and host engaging real-time quizzes, polls, and presentations. The modern alternative to Kahoot, Mentimeter, and Quizizz.",
  keywords: ["quiz", "interactive", "real-time", "education", "presentation", "kahoot alternative"],
  openGraph: {
    title: "Quizzit — Interactive Quiz Platform",
    description: "Create and host engaging real-time quizzes, polls, and presentations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
