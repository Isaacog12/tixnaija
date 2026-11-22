import { NIGERIAN_CITIES } from "@/lib/cities";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const KNOWN = NIGERIAN_CITIES as readonly string[];

interface CitySelectProps {
  value: string;
  onChange: (city: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}

/**
 * Native select over the cities we sell in, with an "Other city" escape hatch
 * for towns outside the list. Used by the organizer create/edit forms so the
 * Discover city filter always has clean values to group on.
 */
export function CitySelect({ value, onChange, id, required, className }: CitySelectProps) {
  const [otherMode, setOtherMode] = useState(() => value !== "" && !KNOWN.includes(value));
  const isKnown = KNOWN.includes(value);
  const selectValue = isKnown ? value : otherMode ? "other" : "";

  return (
    <div className={className}>
      <select
        id={id}
        value={selectValue}
        required={required && !otherMode}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "other") {
            setOtherMode(true);
            onChange("");
          } else {
            setOtherMode(false);
            onChange(next);
          }
        }}
        className="h-11 w-full appearance-none rounded-md border border-border/70 bg-card px-3 text-sm text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <option value="" disabled>
          Select a city
        </option>
        {NIGERIAN_CITIES.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
        <option value="other">Other city</option>
      </select>

      {otherMode && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="City name"
          aria-label="City name"
          required={required}
          className="mt-2 h-11"
        />
      )}
    </div>
  );
}
