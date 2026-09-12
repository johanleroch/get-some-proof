"use client";
import { useState } from "react";
import { googleFontFamilies } from "@convex/domain/googleFontFamilies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function GoogleFontPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const matches = googleFontFamilies.filter((family) =>
    family.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          aria-label="Google font"
        >
          {value ?? "Choose a Google font"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(20rem,calc(100vw-2rem))] space-y-2 p-2"
      >
        <Input
          aria-label="Search Google Fonts"
          placeholder="Search Google Fonts…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="type-small text-ink-2 px-2" role="status">
          {matches.length
            ? `${matches.length} ${matches.length === 1 ? "font" : "fonts"}${matches.length > 60 ? ", showing the first 60" : ""}`
            : "No matching fonts."}
        </p>
        <div
          className="max-h-64 overflow-y-auto"
          aria-label="Google Fonts results"
        >
          {matches.slice(0, 60).map((family) => (
            <Button
              key={family}
              type="button"
              variant="ghost"
              className="w-full justify-start"
              aria-pressed={family === value}
              onClick={() => {
                onChange(family);
                setOpen(false);
              }}
            >
              {family}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
