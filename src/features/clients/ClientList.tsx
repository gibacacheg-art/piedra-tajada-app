"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/database";

export function ClientList() {
  const { canAccess } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });

    if (error) {
      setMessage(`No se pudieron cargar clientes: ${error.message}`);
      setLoading(false);
      return;
    }

    setClients((data ?? []) as Client[]);
    setMessage("");
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      [client.full_name, client.company_name, client.phone, client.email, client.notes].join(" ").toLowerCase().includes(query.toLowerCase())
    );
  }, [clients, query]);

  return (
    <>
      <PageHeader
        eyebrow="CRM básico"
        title="Clientes"
        description="Listado general de clientes con acceso a su ficha individual, historial comercial y seguimiento financiero."
      />

      <section className="panel">
        <div className="toolbar">
          <input placeholder="Buscar cliente, empresa o correo" value={query} onChange={(event) => setQuery(event.target.value)} />
          {canAccess("/clients/new") ? (
            <Link className="primary-button" href="/clients/new">
              Nuevo cliente
            </Link>
          ) : null}
        </div>

        <div className="list" style={{ marginTop: 14 }}>
          {loading && <p className="muted">Cargando clientes...</p>}
          {!loading && filteredClients.length === 0 && <p className="muted">No hay clientes para este filtro.</p>}
          {filteredClients.map((client) => (
            <Link className="list-item" href={`/clients/${client.id}`} key={client.id}>
              <div className="list-item-header">
                <div>
                  <h3>{client.full_name}</h3>
                  <p className="muted">{[client.company_name, client.phone, client.email].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="alert-pill info">Ver ficha</span>
              </div>

              <div className="meta-grid">
                <div className="meta-block">
                  <span>Creado</span>
                  {formatDate(client.created_at.slice(0, 10))}
                </div>
                <div className="meta-block">
                  <span>Empresa</span>
                  {client.company_name || "Persona natural"}
                </div>
              </div>

              {client.notes ? <p>{client.notes}</p> : null}
            </Link>
          ))}
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
