import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-copy">
        <p className="eyebrow">Centro de eventos</p>
        <h1>Reservas, operación y pagos en un solo lugar.</h1>
        <p>
          Un MVP sobrio para recibir solicitudes, confirmar eventos, coordinar equipos y mantener la historia completa
          de cada compromiso.
        </p>
      </section>
      <LoginForm />
    </main>
  );
}
