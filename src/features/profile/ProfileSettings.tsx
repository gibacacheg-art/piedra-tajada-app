"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/lib/supabase";

export function ProfileSettings() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone: ""
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
    </>
  );
}
