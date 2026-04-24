"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/database";

type CalendarMode = "week" | "month" | "quarter" | "semester" | "year";

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getMonthGrid(anchor: Date) {
  const first = startOfWeek(startOfMonth(anchor));
  const lastMonthDay = endOfMonth(anchor);
  const last = addDays(startOfWeek(lastMonthDay), 6);
  const days: Date[] = [];
  let current = first;

  while (current <= last) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }

  return days;
}

function getWeekDays(anchor: Date) {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_item, index) => addDays(first, index));
}

function dayAvailabilityLabel(dayEvents: Event[]) {
  if (dayEvents.length === 0) return "Disponible";
  if (dayEvents.some((event) => event.status === "cancelled")) {
    const activeEvents = dayEvents.filter((event) => event.status !== "cancelled");
    if (activeEvents.length === 0) return "Sin uso activo";
  }

  return "Ocupado";
}

export function EventCalendar() {
  const { hasRole } = useAuth();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState("");
  const isAvailabilityViewer = hasRole("consulta_disponibilidad");

  const visibleDays = useMemo(() => (mode === "week" ? getWeekDays(anchorDate) : getMonthGrid(anchorDate)), [anchorDate, mode]);
  const range = useMemo(() => {
    if (mode === "quarter" || mode === "semester" || mode === "year") {
      const months = mode === "quarter" ? 3 : mode === "semester" ? 6 : 12;
      const from = startOfMonth(anchorDate);
      const to = endOfMonth(addMonths(anchorDate, months - 1));
      return { from: toDateValue(from), to: toDateValue(to) };
    }

    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    return { from: toDateValue(first), to: toDateValue(last) };
  }, [anchorDate, mode, visibleDays]);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*, clients(full_name, phone, email, company_name)")
      .gte("event_date", range.from)
      .lte("event_date", range.to)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      setMessage(`No se pudo cargar calendario: ${error.message}`);
      return;
    }

    setEvents((data ?? []) as Event[]);
    setMessage("");
  }

  useEffect(() => {
    loadEvents();
  }, [isAvailabilityViewer, range.from, range.to]);

  function move(direction: -1 | 1) {
    setAnchorDate((current) => {
      if (mode === "week") return addDays(current, direction * 7);
      if (mode === "quarter") return addMonths(current, direction * 3);
      if (mode === "semester") return addMonths(current, direction * 6);
      if (mode === "year") return addMonths(current, direction * 12);
      return addMonths(current, direction);
    });
  }

  function eventsForDay(day: Date) {
    const value = toDateValue(day);
    return events.filter((event) => event.event_date === value);
  }

  const title =
    mode === "week"
      ? `${formatDate(range.from)} - ${formatDate(range.to)}`
      : mode === "month"
        ? new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(anchorDate)
        : `${formatDate(range.from)} - ${formatDate(range.to)}`;

  const longRangeEvents = useMemo(() => {
    const groups = new Map<string, Event[]>();

    events.forEach((event) => {
      const label = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(`${event.event_date}T00:00:00`));
      const current = groups.get(label) ?? [];
      current.push(event);
      groups.set(label, current);
    });

    return Array.from(groups.entries());
  }, [events]);

  return (
    <>
      <PageHeader
        eyebrow="Disponibilidad"
        title="Calendario de eventos"
        description={
          isAvailabilityViewer
            ? "Empieza aquí para revisar disponibilidad y luego abrir el detalle del caso en modo solo lectura."
            : "Consulta pre-reservas, eventos confirmados y ejecución por semana, mes o rangos largos."
        }
      />

      <section className="panel">
        <div className="calendar-toolbar">
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => move(-1)}>
              Anterior
            </button>
            <button className="secondary-button" type="button" onClick={() => setAnchorDate(new Date())}>
              Ir a hoy
            </button>
            <button className="secondary-button" type="button" onClick={() => move(1)}>
              Siguiente
            </button>
          </div>

          <strong>{title}</strong>

          <div className="button-row">
            <button className={mode === "week" ? "primary-button" : "secondary-button"} type="button" onClick={() => setMode("week")}>
              Semana
            </button>
            <button className={mode === "month" ? "primary-button" : "secondary-button"} type="button" onClick={() => setMode("month")}>
              Mes
            </button>
            <button className={mode === "quarter" ? "primary-button" : "secondary-button"} type="button" onClick={() => setMode("quarter")}>
              3 meses
            </button>
            <button className={mode === "semester" ? "primary-button" : "secondary-button"} type="button" onClick={() => setMode("semester")}>
              6 meses
            </button>
            <button className={mode === "year" ? "primary-button" : "secondary-button"} type="button" onClick={() => setMode("year")}>
              Año
            </button>
          </div>
        </div>

        {mode === "week" || mode === "month" ? (
          <>
            <div className={mode === "week" ? "calendar-grid calendar-grid-week" : "calendar-grid calendar-grid-month"}>
              {visibleDays.map((day) => {
                const dayEvents = eventsForDay(day);
                const isOutsideMonth = mode === "month" && day.getMonth() !== anchorDate.getMonth();
                const isToday = toDateValue(day) === toDateValue(new Date());

                return (
                  <article className={`calendar-day${isOutsideMonth ? " is-muted" : ""}${isToday ? " is-today" : ""}`} key={toDateValue(day)}>
                    <header>
                      <span>{new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(day)}</span>
                      <strong>{new Intl.DateTimeFormat("es-CL", { day: "2-digit" }).format(day)}</strong>
                    </header>

                    <div className="calendar-events">
                      {dayEvents.length === 0 && <p className="muted">Disponible</p>}
                      {dayEvents.map((event) => (
                        <Link className="calendar-event" href={`/events/${event.id}`} key={event.id}>
                          <div>
                            <strong>{event.event_name}</strong>
                            <p>
                              {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)} ·{" "}
                              {event.clients?.full_name ?? "Sin cliente"}
                            </p>
                          </div>
                          <StatusBadge status={event.status} />
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="calendar-mobile-list">
              {visibleDays.map((day) => {
                const dayEvents = eventsForDay(day);
                const isOutsideMonth = mode === "month" && day.getMonth() !== anchorDate.getMonth();
                const isToday = toDateValue(day) === toDateValue(new Date());
                const availability = dayAvailabilityLabel(dayEvents);

                if (isOutsideMonth) {
                  return null;
                }

                return (
                  <article className={`calendar-mobile-day${isToday ? " is-today" : ""}`} key={`mobile-${toDateValue(day)}`}>
                    <div className="calendar-mobile-day-header">
                      <div>
                        <p className="eyebrow">{new Intl.DateTimeFormat("es-CL", { weekday: "long" }).format(day)}</p>
                        <h3>{formatDate(toDateValue(day))}</h3>
                      </div>
                      <span className={`availability-pill${dayEvents.length > 0 ? " is-busy" : ""}`}>{availability}</span>
                    </div>

                    {dayEvents.length === 0 ? (
                      <p className="muted">No hay eventos registrados para este día.</p>
                    ) : (
                      <div className="calendar-mobile-events">
                        {dayEvents.map((event) => (
                          <Link className="calendar-event" href={`/events/${event.id}`} key={event.id}>
                            <div>
                              <strong>{event.event_name}</strong>
                              <p>
                                {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)} ·{" "}
                                {isAvailabilityViewer ? "Reservado" : event.clients?.full_name ?? "Sin cliente"}
                              </p>
                            </div>
                            <StatusBadge status={event.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="agenda-range">
            {longRangeEvents.length === 0 && <p className="muted">No hay eventos en este rango.</p>}
            {longRangeEvents.map(([monthLabel, monthEvents]) => (
              <section className="agenda-month" key={monthLabel}>
                <div className="list-item-header">
                  <h3>{monthLabel}</h3>
                  <span className="muted">{monthEvents.length} eventos</span>
                </div>
                <div className="list">
                  {monthEvents.map((event) => (
                    <Link className="list-item" href={`/events/${event.id}`} key={event.id}>
                      <div className="list-item-header">
                        <div>
                          <h3>{event.event_name}</h3>
                          <p className="muted">
                            {formatDate(event.event_date)} · {event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)} ·{" "}
                            {isAvailabilityViewer ? "Reservado" : event.clients?.full_name ?? "Sin cliente"}
                          </p>
                        </div>
                        <StatusBadge status={event.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {message && <p className="form-message">{message}</p>}
      </section>
    </>
  );
}
