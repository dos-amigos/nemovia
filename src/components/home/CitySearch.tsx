"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { filterComuni, type VenetoComune } from "@/lib/constants/veneto-comuni";

export function CitySearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(() => filterComuni(query), [query]);

  // Show dropdown when there are results
  React.useEffect(() => {
    setOpen(filtered.length > 0);
    setHighlightIndex(-1);
  }, [filtered]);

  // Close on click outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        !inputRef.current?.parentElement?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectCity(city: VenetoComune) {
    setOpen(false);
    setQuery("");
    router.push(
      `/cerca?cityName=${encodeURIComponent(`${city.nome} (${city.provincia})`)}&lat=${city.lat}&lng=${city.lng}&raggio=30`
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filtered.length - 1
      );
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectCity(filtered[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  return (
    <div className="relative mt-6 w-full max-w-sm sm:max-w-md">
      {/* Search input styled as glass pill */}
      <div className="flex items-center gap-3 rounded-full border border-white/30 bg-white/20 px-5 py-3 backdrop-blur-sm transition-colors focus-within:bg-white/30">
        <Search className="h-5 w-5 shrink-0 text-white" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => filtered.length > 0 && setOpen(true)}
          placeholder="Cerca per città..."
          className="w-full bg-transparent text-white placeholder:text-white/60 focus:outline-none"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
      </div>

      {/* Dropdown results */}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-[200px] overflow-y-auto rounded-lg border border-white/20 bg-black/70 backdrop-blur-md"
        >
          {filtered.map((city, i) => (
            <li
              key={`${city.nome}-${city.provincia}`}
              role="option"
              aria-selected={i === highlightIndex}
              className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-white transition-colors ${
                i === highlightIndex
                  ? "bg-white/20"
                  : "hover:bg-white/10"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCity(city);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/60" />
              <span>
                {city.nome}{" "}
                <span className="text-white/50">({city.provincia})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
