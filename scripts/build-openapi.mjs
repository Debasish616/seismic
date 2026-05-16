#!/usr/bin/env node
/**
 * Build cards/openapi.json from the deployed Rave backend OpenAPI (/docs/json).
 * Strips internal routes (platform ops, health) and rebrands metadata for Seismic docs.
 *
 * Usage (from repo root):
 *   node cards/scripts/build-openapi.mjs
 *   SOURCE_URL=http://localhost:4010/docs/json node cards/scripts/build-openapi.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "openapi.json");

const SOURCE =
  process.env.SOURCE_URL?.trim() || "https://rave-card-api-production.up.railway.app/docs/json";

function tagsFor(route, _method) {
  if (route === "/api/v1/auth/session" || route === "/api/v1/me") return ["Authentication"];
  if (route.includes("/pin") || route.includes("/freeze") || route.includes("/cards")) return ["Cards"];
  if (route.includes("/cardholders") || route.match(/\/organizations(\/[^/]+)?$/))
    return route.includes("/cardholders") ? ["Organizations", "Cardholders"] : ["Organizations"];
  return ["Organizations"];
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Failed to fetch ${SOURCE}: ${res.status} ${await res.text()}`);
  const raw = await res.json();

  const strip = (p) =>
    p.startsWith("/api/platform") || p === "/health" || p.startsWith("/.well-known");

  const paths = {};
  for (const [p, ops] of Object.entries(raw.paths || {})) {
    if (strip(p)) continue;
    paths[p] = {};
    for (const [method, v] of Object.entries(ops)) {
      if (!v || typeof v !== "object" || method === "parameters") {
        paths[p][method] = v;
        continue;
      }
      const op = { ...v };
      op.tags = tagsFor(p, method);
      if (p === "/api/v1/auth/session") delete op.security;
      paths[p][method] = op;
    }
  }

  raw.paths = paths;
  raw.openapi = raw.openapi || "3.1.0";
  raw.info = {
    title: "Seismic Cards API — playground",
    description:
      "Seismic Cards partner REST API for Seismic Playground (/playground): exchange credentials for a session JWT, manage organizations (tenants), cardholders, and virtual cards.",
    version: raw.info?.version ?? "1.0.0",
  };

  raw.servers = [
    { url: "https://sandbox-api.seismic-cards.systems", description: "Sandbox" },
    { url: "https://api.seismic-cards.systems", description: "Production" },
    { url: "https://rave-card-api-production.up.railway.app", description: "Staging / beta (temporary)" },
  ];

  const tagNames = new Set();
  for (const ops of Object.values(paths)) {
    for (const method of Object.keys(ops)) {
      const op = ops[method];
      if (op?.tags) op.tags.forEach((t) => tagNames.add(t));
    }
  }
  const descriptions = {
    Authentication: "Session JWT from POST /api/v1/auth/session and caller context.",
    Organizations: "Organizations (tenants) under your program.",
    Cardholders: "Provisioning and listing cardholders.",
    Cards: "Issue and manage virtual cards (PIN, freeze).",
  };
  raw.tags = [...tagNames].sort().map((name) => ({ name, description: descriptions[name] || "" }));

  raw.components = raw.components || {};
  raw.components.securitySchemes = {
    partnerBearer: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Paste accessToken from POST /api/v1/auth/session (Bearer). Valid ~1 hour. Do not expose client secrets in the browser playground on public docs — use sandbox keys only.",
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(raw, null, 2));
  console.log(`Wrote ${OUT} (${Object.keys(paths).length} paths from ${SOURCE})`);
}

await main();
