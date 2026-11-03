import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export function DatePicker({ name, value, onChange, required = false, ariaLabel }: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthDate(value));
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDate(value);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
        && !popoverRef.current?.contains(event.target)
      ) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const firstDayOffset = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const dayCells = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function toggleCalendar() {
    if (!open) {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (bounds) {
        const calendarHeight = 330;
        const top = bounds.bottom + calendarHeight <= window.innerHeight - 8
          ? bounds.bottom + 8
          : Math.max(8, bounds.top - calendarHeight - 8);
        setPopoverPosition({
          top,
          left: Math.max(8, Math.min(bounds.left, window.innerWidth - 300)),
        });
      }
      setVisibleMonth(getMonthDate(value));
    }
    setOpen((current) => !current);
  }

  function chooseDay(day: number) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    onChange(formatISODate(date));
    setOpen(false);
  }

  return (
    <div className="fluxary-date-picker" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <div className="fluxary-date-control">
        <input
          type="text"
          value={formatDisplayDate(value)}
          placeholder="dd/mm/aaaa"
          aria-label={ariaLabel}
          required={required}
          readOnly
          onClick={toggleCalendar}
        />
        <button
          type="button"
          className="fluxary-calendar-trigger"
          aria-label="Abrir calendário"
          aria-expanded={open}
          onClick={toggleCalendar}
        >
          <CalendarDays size={16} />
        </button>
      </div>
      {open && createPortal(
        <div className="fluxary-calendar-popover" role="dialog" aria-label="Escolher data" style={popoverPosition} ref={popoverRef}>
          <div className="fluxary-calendar-heading">
            <button type="button" className="fluxary-calendar-nav" aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button>
            <strong>{monthLabel}</strong>
            <button type="button" className="fluxary-calendar-nav" aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button>
          </div>
          <div className="fluxary-calendar-grid fluxary-calendar-weekdays">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="fluxary-calendar-grid">
            {dayCells.map((day, index) => {
              if (!day) return <span className="fluxary-calendar-empty" key={`empty-${index}`} />;
              const isSelected = selectedDate?.getFullYear() === visibleMonth.getFullYear()
                && selectedDate.getMonth() === visibleMonth.getMonth()
                && selectedDate.getDate() === day;
              const today = new Date();
              const isToday = today.getFullYear() === visibleMonth.getFullYear()
                && today.getMonth() === visibleMonth.getMonth()
                && today.getDate() === day;
              return (
                <button
                  type="button"
                  key={day}
                  className={`fluxary-calendar-day ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => chooseDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button type="button" className="fluxary-calendar-today" onClick={() => {
            const today = new Date();
            onChange(formatISODate(today));
            setVisibleMonth(getMonthDate(formatISODate(today)));
            setOpen(false);
          }}>Hoje</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? date
    : null;
}

function getMonthDate(value: string) {
  const date = parseDate(value) ?? new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDisplayDate(value: string) {
  const date = parseDate(value);
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
