import { ChevronDown, Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type StyledSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

// Seletor customizado para manter a mesma aparência em todos os navegadores.
export function StyledSelect({ name, value, options, onChange, ariaLabel, required = false }: {
  name: string;
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function showOptions() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled));
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      showOptions();
      return;
    }
    if (!open) return;
    const enabledIndices = options.flatMap((option, index) => option.disabled ? [] : [index]);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const currentPosition = enabledIndices.indexOf(activeIndex);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextPosition = (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
      setActiveIndex(enabledIndices[nextPosition] ?? 0);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? enabledIndices[0] ?? 0 : enabledIndices.at(-1) ?? 0);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div className={`styled-select ${open ? "styled-select-open" : ""}`} ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        className={`styled-select-trigger ${open ? "styled-select-trigger-open" : ""}`}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-required={required || undefined}
        onClick={() => open ? setOpen(false) : showOptions()}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label ?? "Escolha uma opção"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="styled-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              className={`styled-select-option ${option.value === value ? "styled-select-option-selected" : ""} ${activeIndex === index ? "styled-select-option-active" : ""}`}
              type="button"
              role="option"
              id={`${listboxId}-option-${index}`}
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              key={option.value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
