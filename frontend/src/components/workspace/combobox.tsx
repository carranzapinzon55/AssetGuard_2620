"use client";

import { useId, useState, type KeyboardEvent } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage = "No hay resultados.",
  required = false,
  disabled = false,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  function choose(option: ComboboxOption) {
    onValueChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="combobox-root">
      <input
        className="work-input combobox-input"
        role="combobox"
        type="text"
        value={open ? query : selectedOption?.label ?? ""}
        placeholder={open ? searchPlaceholder : placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-required={required || undefined}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActiveIndex(0);
        }}
        onChange={(event) => {
          setOpen(true);
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
      />
      {open && (
        <div className="combobox-list" id={listId} role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="combobox-empty" role="option" aria-selected="false">{emptyMessage}</div>
          ) : filteredOptions.map((option, index) => (
            <div
              className="combobox-option"
              id={`${listId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}