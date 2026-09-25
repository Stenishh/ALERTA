import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALERTA",
  description: "Sistema inteligente de monitoramento IoT para prevenção de quedas",
};

const restoreTheme = `try{if(localStorage.getItem("alerta-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch{}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restoreTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
