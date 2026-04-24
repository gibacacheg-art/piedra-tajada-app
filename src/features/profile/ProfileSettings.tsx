"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

export function ProfileSettings() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: ""
  });
  const [passwordForm, setPasswordForm] = useState({
    new_password: "",
    confirm_password: ""
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      const { data, error } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single();

      if (error) {
        setMessage(`No se pudo cargar perfil: ${error.message}`);
        return;
      }

      setForm({
        full_name: data.full_name ?? "",
        phone: data.phone ?? ""
      });
    }

    loadProfile();
  }, [user]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setMessage("Guardando perfil...");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null
      })
      .eq("id", user.id);

    if (error) {
      setMessage(`No se pudo guardar perfil: ${error.message}`);
      return;
    }

    setMessage("Perfil actualizado correctamente.");
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    if (passwordForm.new_password.length < 6) {
      setPasswordMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMessage("Actualizando contraseña...");

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.new_password
    });

    setIsUpdatingPassword(false);

    if (error) {
      setPasswordMessage(`No se pudo actualizar la contraseña: ${error.message}`);
      return;
    }

    setPasswordForm({
      new_password: "",
      confirm_password: ""
    });
    setPasswordMessage("Contraseña actualizada correctamente.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Actualiza tu nombre para que aparezca correctamente en tareas, bitácora y responsables."
      />

      <form className="panel edit-form" onSubmit={saveProfile}>
        <label>
          Correo
          <input disabled value={user?.email ?? ""} />
        </label>
        <label>
          Nombre completo
          <input
            required
            value={form.full_name}
            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            placeholder="Gabriel Ibacache"
          />
        </label>
        <label>
          Teléfono
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="+56 9..."
          />
        </label>
        <button className="primary-button" type="submit">
          Guardar perfil
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>

      <form className="panel edit-form" onSubmit={updatePassword}>
        <h2>Cambiar contraseña</h2>
        <p className="muted">Usa una clave nueva para tu acceso personal. Este cambio afecta solo a tu usuario.</p>
        <label>
          Nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={passwordForm.new_password}
            onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
            placeholder="Nueva contraseña"
          />
        </label>
        <label>
          Confirmar nueva contraseña
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={passwordForm.confirm_password}
            onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
            placeholder="Repite la nueva contraseña"
          />
        </label>
        <button className="primary-button" type="submit" disabled={isUpdatingPassword}>
          Guardar nueva contraseña
        </button>
        {passwordMessage && <p className="form-message">{passwordMessage}</p>}
      </form>
    </>
  );
}
