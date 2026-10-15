"use client";

import type React from "react";
import { useId, useState } from "react";

type Tab = { key: string; label: string; count?: number; content: React.ReactNode; footer?: React.ReactNode };

/**
 * One panel, several lists: keeps the dashboard's side column within a single screen.
 * The panel stretches to the height of its column and scrolls its list inside.
 */
export function SideTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const id = useId();
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <section className="gene-panel gene-tabs" aria-label={label}>
      <div className="gene-tabs__bar" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={t.key === current.key}
            aria-controls={`${id}-panel`}
            className="gene-tabs__tab"
            onClick={() => setActive(t.key)}
          >
            {t.label}
            {t.count ? <span className="gene-tabs__count">{t.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="gene-tabs__body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current.key}`}>
        {current.content}
      </div>
      {current.footer ? <div className="gene-tabs__footer">{current.footer}</div> : null}
    </section>
  );
}
