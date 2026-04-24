# Piedra Tajada App

App web colaborativa para **Piedra Tajada SpA**, enfocada en la gestión de clientes, solicitudes de reserva, eventos, pagos, documentos, tareas y coordinación operativa.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Row Level Security (RLS)
- Netlify para despliegue del frontend

## Módulos principales

- `Dashboard`: resumen operativo y financiero
- `Clientes`: alta, edición y ficha 360
- `Solicitudes`: creación, cotización y paso a evento
- `Eventos`: operación, responsables, pagos, documentos y bitácora
- `Calendario`: vista semanal, mensual y por rangos
- `Pagos`: vista consolidada por evento
- `Documentos`: repositorio central
- `Mis tareas`: seguimiento personal
- `Usuarios`: perfiles y roles

## Estructura

```text
src/
  app/
    dashboard/
    clients/
    requests/
    events/
    payments/
    documents/
    calendar/
    my-tasks/
    admin/users/
    login/
    profile/
  components/
    layout/
    ui/
  features/
    auth/
    dashboard/
    clients/
    requests/
    events/
    payments/
    documents/
    calendar/
    tasks/
    profile/
    admin/
  lib/
  types/
supabase/
  schema.sql
  rls.sql
  002_quote_items.sql
```

## Variables de entorno

Crea `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Correr localmente

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## SQL de Supabase

Ejecuta en este orden:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/002_quote_items.sql`
4. `supabase/003_payment_invoicing.sql` (si quieres activar el modelo estructurado de facturación)
5. `supabase/004_archive_and_trash.sql` (para activar archivado y papelera recuperable)

## Despliegue en Netlify

1. subir el proyecto a GitHub
2. conectar el repositorio en Netlify
3. configurar variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. desplegar

Después, en Supabase Auth, agrega la URL pública de Netlify en:

- `Site URL`
- `Redirect URLs`

## Notas importantes

- La app puede seguir evolucionando localmente aunque ya esté desplegada.
- La facturación puede funcionar con el esquema actual, pero la migración `003_payment_invoicing.sql` deja los datos de factura más sólidos para reportes y mantenimiento.
- Solicitudes y eventos ahora pueden archivarse o enviarse a papelera antes de un borrado definitivo.
