import type { Field } from "payload";

/**
 * Keep a collection's "Columns" picker to fields that make sense in a table. Every named field
 * not in `allowed` gets `admin.disableListColumn`; layout fields (tabs, rows, collapsibles) are
 * walked, and everything inside a named group or tab is hidden since its columns would be
 * prefixed sub-fields (e.g. "SEO > Title"). System columns (ID, dates, status) are unaffected.
 */
export function limitListColumns(fields: Field[], allowed: readonly string[]): Field[] {
  const keep = new Set(allowed);
  const walk = (list: Field[], inside: boolean): Field[] =>
    list.map((field) => {
      if (field.type === "tabs") {
        return { ...field, tabs: field.tabs.map((tab) => ({ ...tab, fields: walk(tab.fields, inside || "name" in tab) })) };
      }
      if (field.type === "row" || field.type === "collapsible") {
        return { ...field, fields: walk(field.fields, inside) };
      }
      if (!("name" in field) || (!inside && keep.has(field.name))) return field;
      const hidden = { ...field, admin: { ...field.admin, disableListColumn: true } } as Field;
      return field.type === "group" ? { ...hidden, fields: walk(field.fields, true) } as Field : hidden;
    });
  return walk(fields, false);
}
