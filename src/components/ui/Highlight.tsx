function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Emphasises the words of `query` inside `text`. */
export function Highlight({ text, query, className }: { text: string; query?: string; className?: string }) {
  const terms = query?.trim().split(/\s+/).filter((t) => t.length > 1) ?? [];
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={className ?? "rounded-sm bg-accent/15 px-0.5 text-inherit"}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
