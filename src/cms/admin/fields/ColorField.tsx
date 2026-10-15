"use client";

import { FieldDescription, FieldLabel, useField } from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";

/** Hex colour with a swatch picker, for category tints. */
export const ColorField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue, showError, errorMessage } = useField<string>({ path: path ?? field.name });
  const hex = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#ece9e2";
  return (
    <div className="field-type text gene-color-field">
      <FieldLabel label={field.label ?? "Colour"} path={path} />
      <div className="gene-color-field__row">
        <input type="color" value={hex} onChange={(e) => setValue(e.target.value)} aria-label="Pick colour" />
        <input type="text" value={value ?? ""} onChange={(e) => setValue(e.target.value)} placeholder="#dfe5d5" spellCheck={false} />
        <span className="gene-color-field__sample" style={{ backgroundColor: hex }}>
          Card
        </span>
      </div>
      {showError && <p className="gene-help gene-help--error">{errorMessage}</p>}
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  );
};
