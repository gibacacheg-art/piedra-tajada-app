"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.")
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema)
  });

  async function onSubmit(values: LoginValues) {
    setMessage("Validando acceso...");
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setMessage(`No se pudo iniciar sesión: ${error.message}`);
      return;
    }

    setMessage("");
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit(onSubmit)}>
      <p className="eyebrow">Piedra Tajada SpA</p>
      <h1>Gestión de eventos</h1>
      <p className="muted">Acceso privado para ventas, coordinación, responsables y administración.</p>

      <label>
        Correo
        <input type="email" autoComplete="email" placeholder="correo@piedratajada.cl" {...register("email")} />
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </label>

      <label>
        Contraseña
        <input type="password" autoComplete="current-password" placeholder="Tu contraseña" {...register("password")} />
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </label>

      <div className="button-row">
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          Entrar
        </button>
      </div>

      <p className="muted">El acceso se habilita internamente desde administración y Supabase Auth.</p>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
