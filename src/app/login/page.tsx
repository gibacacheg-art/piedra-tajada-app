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
        <div className="button-row" style={{ marginTop: 16 }}>
          <a className="secondary-button" href="/manual-usuario-piedra-tajada.html" download>
            <svg aria-hidden="true" className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v11" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Descargar manual
          </a>
        </div>
      </section>
      <LoginForm />
    </main>
  );
}
