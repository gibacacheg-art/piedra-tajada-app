"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import type { Database, Profile, Role, UserRole } from "@/types/database";

export function UserRoleAdminSimple() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ full_name: "", phone: "" });

  async function loadData() {
    setLoading(true);
    setMessage("");

    const profilesResponse = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (profilesResponse.error) {
      setMessage(`No se pudieron cargar usuarios: ${profilesResponse.error.message}`);
      setLoading(false);
      return;
    }

    const rolesResponse = await supabase.from("roles").select("*").order("code", { ascending: true });
    if (rolesResponse.error) {
      setMessage(`No se pudieron cargar roles: ${rolesResponse.error.message}`);
      setLoading(false);
      return;
    }

    const userRolesResponse = await supabase.from("user_roles").select("*");
    if (userRolesResponse.error) {
      setMessage(`No se pudieron cargar roles asignados: ${userRolesResponse.error.message}`);
      setLoading(false);
      return;
    }

    setProfiles(profilesResponse.data ?? []);
    setRoles(rolesResponse.data ?? []);
    setUserRoles(userRolesResponse.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function roleName(roleId: string) {
    return roles.find((role) => role.id === roleId)?.name ?? roleId;
  }

  function rolesForUser(userId: string) {
    return userRoles.filter((userRole) => userRole.user_id === userId);
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setForm({
      full_name: profile.full_name,
      phone: profile.phone ?? ""
    });
  }

  async function saveProfile(profileId: string) {
    setMessage("Guardando usuario...");

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null
    };

    const { error } = await supabase.from("profiles").update(profileUpdate as never).eq("id", profileId);

    if (error) {
      setMessage(`No se pudo guardar usuario: ${error.message}`);
      return;
    }

    setEditingId(null);
    await loadData();
  }

  async function toggleAccess(profile: Profile) {
    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      is_active: !profile.is_active
    };

    const { error } = await supabase.from("profiles").update(profileUpdate as never).eq("id", profile.id);

    if (error) {
      setMessage(`No se pudo cambiar acceso: ${error.message}`);
      return;
    }

    await loadData();
  }

  async function addRole(profileId: string) {
    const roleId = selectedRoleByUser[profileId];
    if (!roleId) return;

    const exists = userRoles.some((userRole) => userRole.user_id === profileId && userRole.role_id === roleId);
    if (exists) {
      setMessage("Ese usuario ya tiene el rol seleccionado.");
      return;
    }

    const userRoleInsert: Database["public"]["Tables"]["user_roles"]["Insert"] = {
      user_id: profileId,
      role_id: roleId
    };

    const { error } = await supabase.from("user_roles").insert(userRoleInsert as never);

    if (error) {
      setMessage(`No se pudo asignar rol: ${error.message}`);
      return;
    }

    setSelectedRoleByUser((current) => ({ ...current, [profileId]: "" }));
    await loadData();
  }

  async function removeRole(profileId: string, roleId: string) {
    const shouldRemove = window.confirm(`¿Quitar rol "${roleName(roleId)}" a este usuario?`);
    if (!shouldRemove) return;

    const { error } = await supabase.from("user_roles").delete().eq("user_id", profileId).eq("role_id", roleId);

    if (error) {
      setMessage(`No se pudo quitar rol: ${error.message}`);
      return;
    }

    await loadData();
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios y roles"
        description="Edita datos del equipo, activa o desactiva acceso y asigna permisos."
      />

      <section className="panel">
        <div className="admin-note">
          <h2>Crear o eliminar usuarios</h2>
          <p className="muted">
            Los usuarios reales de Supabase Auth se crean o eliminan desde Supabase Dashboard &gt; Authentication &gt;
            Users. Desde esta pantalla administras perfiles y roles.
          </p>
        </div>

        {loading && <p className="muted">Cargando usuarios...</p>}
        {message && <p className="form-message">{message}</p>}

        <div className="list">
          {profiles.map((profile) => {
            const assignedRoles = rolesForUser(profile.id);

            return (
              <article className="list-item" key={profile.id}>
                <div className="list-item-header">
                  <div>
                    <h3>{profile.full_name}</h3>
                    <p className="muted">
                      {profile.phone || "Sin teléfono"} · {profile.is_active ? "Acceso activo" : "Acceso desactivado"}
                    </p>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => toggleAccess(profile)}>
                    {profile.is_active ? "Desactivar acceso" : "Activar acceso"}
                  </button>
                </div>

                {editingId === profile.id ? (
                  <div className="edit-form">
                    <div className="form-grid-2">
                      <label>
                        Nombre
                        <input
                          required
                          value={form.full_name}
                          onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                        />
                      </label>
                      <label>
                        Teléfono
                        <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                      </label>
                    </div>
                    <div className="button-row">
                      <button className="primary-button" type="button" onClick={() => saveProfile(profile.id)}>
                        Guardar usuario
                      </button>
                      <button className="secondary-button" type="button" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="secondary-button" type="button" onClick={() => startEdit(profile)}>
                    Editar datos
                  </button>
                )}

                <div>
                  <p className="eyebrow">Roles actuales</p>
                  <div className="role-list">
                    {assignedRoles.length === 0 && <span className="muted">Sin roles asignados</span>}
                    {assignedRoles.map((userRole) => (
                      <button className="role-pill" key={userRole.role_id} type="button" onClick={() => removeRole(profile.id, userRole.role_id)}>
                        {roleName(userRole.role_id)} x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="inline-add">
                  <select
                    value={selectedRoleByUser[profile.id] ?? ""}
                    onChange={(event) => setSelectedRoleByUser((current) => ({ ...current, [profile.id]: event.target.value }))}
                  >
                    <option value="">Selecciona rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button className="primary-button" type="button" onClick={() => addRole(profile.id)}>
                    Agregar rol
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
