"use client";

import { useMemo, useState, useEffect } from "react";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";

export const DEFAULT_UNITS = ["pcs", "kg", "g", "lbs", "oz", "L", "ml", "m", "ft", "cm", "box", "pack"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  label?: string;
  labelClassName?: string;
  id?: string;
};

/** Katana-style UOM: pick from presets or enter a custom unit. */
export function UnitOfMeasureField({
  value,
  onChange,
  className = "",
  inputClassName = "kinput",
  label,
  labelClassName = "klabel",
  id,
}: Props) {
  const { units: apiUnits } = useUnitsOfMeasure();

  const presetUnits = useMemo(() => {
    const fromApi = (apiUnits || []).map((u) => u.name).filter(Boolean);
    const merged = [...DEFAULT_UNITS];
    for (const u of fromApi) {
      if (!merged.includes(u)) merged.push(u);
    }
    return merged;
  }, [apiUnits]);

  const normalized = (value || "pcs").trim();
  const isPreset = presetUnits.includes(normalized);
  const [mode, setMode] = useState<"preset" | "custom">(isPreset ? "preset" : "custom");
  const [custom, setCustom] = useState(isPreset ? "" : normalized);

  useEffect(() => {
    const v = (value || "pcs").trim();
    if (presetUnits.includes(v)) {
      setMode("preset");
      setCustom("");
    } else if (v) {
      setMode("custom");
      setCustom(v);
    }
  }, [value, presetUnits]);

  const datalistId = useMemo(() => id || `uom-${Math.random().toString(36).slice(2)}`, [id]);

  return (
    <div className={className}>
      {label && <label className={labelClassName}>{label}</label>}
      <div className="flex gap-2 items-start">
        <select
          className={inputClassName}
          value={mode === "custom" ? "__custom__" : normalized || "pcs"}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setMode("custom");
              onChange(custom || "");
            } else {
              setMode("preset");
              onChange(v);
            }
          }}
        >
          {presetUnits.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
        {mode === "custom" && (
          <input
            className={inputClassName}
            list={datalistId}
            placeholder="Type unit (e.g. bottle)"
            value={custom}
            onChange={(e) => {
              const v = e.target.value;
              setCustom(v);
              onChange(v);
            }}
          />
        )}
      </div>
      <datalist id={datalistId}>
        {presetUnits.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {mode === "custom" && (
        <p className="text-[11px] text-gray-500 mt-1">Enter any unit abbreviation; it will be saved on this item.</p>
      )}
    </div>
  );
}
