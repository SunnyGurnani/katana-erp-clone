"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, X } from "lucide-react";

export type VariantOptionConfig = { name: string; values: string[] };

const PRESET_OPTIONS = ["Color", "Size", "Material", "Style"];
const DEFAULT_OPTIONS: VariantOptionConfig[] = [{ name: "Color", values: [""] }];

type Props = {
  open: boolean;
  onClose: () => void;
  initialOptions?: VariantOptionConfig[] | null;
  onGenerate: (options: VariantOptionConfig[]) => void;
  isPending?: boolean;
};

export function VariantConfigModal({
  open,
  onClose,
  initialOptions,
  onGenerate,
  isPending,
}: Props) {
  const [options, setOptions] = useState<VariantOptionConfig[]>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (open) {
      const src = initialOptions?.length ? initialOptions : DEFAULT_OPTIONS;
      setOptions(src.map((o) => ({ name: o.name, values: o.values.length ? [...o.values] : [""] })));
    }
  }, [open, initialOptions]);

  function setOptionName(idx: number, name: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, name } : o)));
  }

  function setOptionValue(optIdx: number, valIdx: number, value: string) {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optIdx
          ? { ...o, values: o.values.map((v, j) => (j === valIdx ? value : v)) }
          : o,
      ),
    );
  }

  function addOptionValue(optIdx: number) {
    setOptions((prev) =>
      prev.map((o, i) => (i === optIdx ? { ...o, values: [...o.values, ""] } : o)),
    );
  }

  function removeOptionValue(optIdx: number, valIdx: number) {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === optIdx && o.values.length > 1
          ? { ...o, values: o.values.filter((_, j) => j !== valIdx) }
          : o,
      ),
    );
  }

  function handleGenerate() {
    const cleaned = options
      .map((o) => ({
        name: o.name.trim() || "Option",
        values: o.values.map((v) => v.trim()).filter(Boolean),
      }))
      .filter((o) => o.values.length > 0);
    if (cleaned.length === 0) return;
    onGenerate(cleaned);
  }

  return (
    <Modal open={open} onClose={onClose} title="Product variant configuration">
      <p className="text-sm text-gray-600 mb-4">
        Define variant options (e.g. Size, Color), then generate all variant combinations.
      </p>
      <div className="space-y-4">
        {options.map((opt, optIdx) => (
          <div key={optIdx} className="border border-gray-200 rounded-lg p-4">
            <label className="label">Variant option</label>
            <select
              className="input mb-3"
              value={PRESET_OPTIONS.includes(opt.name) ? opt.name : "Custom"}
              onChange={(e) => {
                const v = e.target.value;
                setOptionName(optIdx, v === "Custom" ? "" : v);
              }}
            >
              {PRESET_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="Custom">Custom…</option>
            </select>
            {!PRESET_OPTIONS.includes(opt.name) && (
              <input
                className="input mb-3"
                placeholder="Option name"
                value={opt.name}
                onChange={(e) => setOptionName(optIdx, e.target.value)}
              />
            )}
            <label className="label">Option values</label>
            <div className="space-y-2">
              {opt.values.map((val, valIdx) => (
                <div key={valIdx} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="e.g. 1 ltr"
                    value={val}
                    onChange={(e) => setOptionValue(optIdx, valIdx, e.target.value)}
                  />
                  {opt.values.length > 1 && (
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-red-600"
                      onClick={() => removeOptionValue(optIdx, valIdx)}
                      aria-label="Remove value"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 font-medium flex items-center gap-1"
              onClick={() => addOptionValue(optIdx)}
            >
              <Plus size={14} /> Add value
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? "Generating…" : "Generate product variants"}
        </button>
      </div>
    </Modal>
  );
}
