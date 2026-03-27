"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface Props {
  actions: Action[];
}

const ITEM_PX = 36;
const GAP = 4;

export function ActionMenu({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = actions.length * ITEM_PX + 8;
      let top = rect.bottom + GAP;
      if (top + menuH > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuH - GAP);
      }
      setMenuStyle({
        position: "fixed",
        top,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
        minWidth: 140,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const menu =
    open &&
    menuStyle &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        className="rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        style={menuStyle}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${a.variant === "danger" ? "text-red-600" : "text-gray-700"} ${a.disabled ? "cursor-not-allowed opacity-40" : ""}`}
            disabled={a.disabled}
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
              setOpen(false);
            }}
          >
            <span className="flex items-center gap-2">
              {a.icon}
              {a.label}
            </span>
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <>
      <div className="relative" ref={triggerRef}>
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {menu}
    </>
  );
}
