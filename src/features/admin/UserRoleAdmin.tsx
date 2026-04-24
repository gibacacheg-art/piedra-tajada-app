"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase";
import type { Database, Profile, Role, UserRole } from "@/types/database";

type ProfileWithRoles = Profile & {
  user_roles?: UserRole[];
};

export function UserRoleAdmin() {
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [message, setMessage] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });

  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  async function loadData() {
    const [profilesResponse, rolesResponse, userRolesResponse] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("code", { ascending: true }),
      supabase.from("user_roles").select("*")
    ]);

    if (profilesResponse.error) {
      setMessage(`No se pudieron cargar usuarios: ${profilesResponse.error.message}`);
      return;
    }

    if (rolesResponse.error) {
      setMessage(`No se pudieron cargar roles: ${rolesResponse.error.message}`);
      return;
    }

    if (userRolesResponse.error) {
      setMessage(`No se pudieron cargar roles de usuarios: ${userRolesResponse.error.message}`);
      return;
    }

    const nextRoles = (rolesResponse.data ?? []) as Role[];
    const nextUserRoles = (userRolesResponse.data ?? []) as UserRole[];
    const rawProfiles = (profilesResponse.data ?? []) as Profile[];
    const nextProfiles = rawProfiles.map((profile) => ({
      ...profile,
      user_roles: nextUserRoles
        .filter((userRole) => userRole.user_id === profile.id)
        .map((userRole) => ({
          ...userRole,
          roles: nextRoles.find((role) => role.id === userRole.role_id) ?? null
        }))
    }));

    setProfiles(nextProfiles as ProfileWithRoles[]);
    setRoles(nextRoles);
    setMessage("");
  }

  useEffect(() => {
    loadData();
  }, []);

  function startEdit(profile: Profile) {
    setEditingProfileId(profile.id);
    setProfileForm({
      full_name: profile.full_name,
      phone: profile.phone ?? ""
    });
  }

  async function saveProfile(profileId: string) {
    setMessage("Guardando usuario...");

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: profileForm.full_name.trim(),
      phone: profileForm.phone.trim() || null
    };

    const { error } = await supabase
      .from("profiles")
      .update(profileUpdate as never)
      .eq("id", profileId);

    if (error) {
      setMessage(`No se pudo guardar usuario: ${error.message}`);
      return;
    }

    setEditingProfileId(null);
    setMessage("");
    await loadData();
  }

  async function toggleActive(profile: Profile) {
    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      is_active: !profile.is_active
    };

    const { error } = await supabase
      .from("profiles")
      .update(profileUpdate as never)
      .eq("id", profile.id);

    if (error) {
      setMessage(`No se pudo cambiar estado: ${error.message}`);
      return;
    }

    setMessage("");
    await loadData();
  }

  async function addRole(profile: ProfileWithRoles) {
    const roleId = selectedRoles[profile.id];
    if (!roleId) return;

    const alreadyHasRole = profile.user_roles?.some((userRole) => userRole.role_id === roleId);
    if (alreadyHasRole) {
      setMessage("El usuario ya tiene ese rol.");
      return;
    }

    const userRoleInsert: Database["public"]["Tables"]["user_roles"]["Insert"] = {
      user_id: profile.id,
      role_id: roleId
    };

    const { error } = await supabase.from("user_roles").insert(userRoleInsert as never);

    if (error) {
      setMessage(`No se pudo asignar rol: ${error.message}`);
      return;
    }

    setSelectedRoles((current) => ({ ...current, [profile.id]: "" }));
    setMessage("");
    await loadData();
  }

  async function removeRole(profileId: string, roleId: string) {
    const role = roleById.get(roleId);
    const shouldRemove = window.confirm(`¿Quitar rol "${role?.name ?? "seleccionado"}" a este usuario?`);
    if (!shouldRemove) return;

    const { error } = await supabase.from("user_roles").delete().eq("user_id", profileId).eq("role_id", roleId);

    if (error) {
      setMessage(`No se pudo quitar rol: ${error.message}`);
      return;
    }

    setMessage("");
    await loadData();
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios y roles"
        description="Administra perfiles activos y permisos base del equipo."
      />

      <section className="panel">
        <div className="admin-note">
          <h2>Crear o eliminar usuarios</h2>
          <p className="muted">
            Por seguridad, los usuarios reales de Supabase Auth se crean o eliminan desde el panel de Supabase. La app no
            usa la service_role key en el navegador. Después de crear un usuario en Supabase, aparecerá aquí para asignar
            nombre, estado y roles.
          </p>
          <ol>
            <li>Crear usuario: Supabase Dashboard {" > "} Authentication {" > "} Users {" > "} Add user.</li>
            <li>Eliminar usuario: Supabase Dashboard {" > "} Authentication {" > "} Users {" > "} seleccionar usuario {" > "} Delete user.</li>
            <li>Bloquear acceso sin eliminar: usa el botón Desactivar acceso en esta pantalla.</li>
          </ol>
        </div>

        <div className="list">
          {profiles.length === 0 && <p className="muted">No hay usuarios visibles para tu rol.</p>}
          {profiles.map((profile) => (
            <article className="list-item" key={profile.id}>
              <div className="list-item-header">
                <div>
                  <h3>{profile.full_name}</h3>
                  <p className="muted">
                    {profile.phone || "Sin teléfono"} · {profile.is_active ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => toggleActive(profile)}>
                  {profile.is_active ? "Desactivar acceso" : "Activar acceso"}
                </button>
              </div>

              {editingProfileId === profile.id ? (
                <div className="edit-form">
                  <div className="form-grid-2">
                    <label>
                      Nombre
                      <input
                        required
                        value={profileForm.full_name}
                        onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                      />
                    </label>
                    <label>
                      Teléfono
                      <input
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="button-row">
                    <button className="primary-button" type="button" onClick={() => saveProfile(profile.id)}>
                      Guardar usuario
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setEditingProfileId(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button className="secondary-button" type="button" onClick={() => startEdit(profile)}>
                  Editar perfil
                </button>
              )}

              <div>
                <p className="eyebrow">Roles actuales</p>
                <div className="role-list">
                  {(profile.user_roles ?? []).length === 0 && <span className="muted">Sin roles asignados</span>}
                  {(profile.user_roles ?? []).map((userRole) => (
                    <button className="role-pill" key={userRole.role_id} type="button" onClick={() => removeRole(profile.id, userRole.role_id)}>
                      {userRole.roles?.name ?? userRole.role_id} ×
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-add">
                <select
                  value={selectedRoles[profile.id] ?? ""}
                  onChange={(event) => setSelectedRoles((current) => ({ ...current, [profile.id]: event.target.value }))}
                >
                  <option value="">Selecciona rol</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <button className="primary-button" type="button" onClick={() => addRole(profile)}>
                  Agregar rol
                </button>
              </div>
            </article>
          ))}
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
