import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "Piedra Tajada SpA | Gestión de reservas y eventos",
  description: "App colaborativa para gestionar clientes, solicitudes, eventos, pagos, tareas, documentos y trazabilidad."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={manrope.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
