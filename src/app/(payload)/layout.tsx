/* Payload admin root layout (standard Payload 3 template). */
import config from "@payload-config";
import "@payloadcms/next/css";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import { Inter, Newsreader } from "next/font/google";
import type { ServerFunctionClient } from "payload";
import type React from "react";
import { importMap } from "./admin/importMap.js";
import "./custom.css";

// next/font registers @font-face globally; the family name is handed to Payload's --font-body below.
const inter = Inter({ subsets: ["latin"], display: "swap" });
// The site's editorial serif, for the login screen's headings (--gene-serif in custom.css).
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], display: "swap", preload: false });

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <style>{`:root{--font-body:${inter.style.fontFamily},ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--gene-serif:${newsreader.style.fontFamily},Georgia,serif}`}</style>
      {children}
    </RootLayout>
  );
}
