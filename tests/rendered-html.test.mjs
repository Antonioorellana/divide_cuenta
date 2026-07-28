import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renderiza la aplicación La Justa", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>La Justa<\/title>/i);
  assert.match(html, /Divide\./);
  assert.match(html, /Fotografiar cuenta/);
  assert.match(html, /Privada por diseño/);
  assert.match(
    html,
    /Desarrollado por(?:\s*<!-- -->)?\s*<strong>Orvedevs<\/strong>/,
  );
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("publica metadatos de una PWA instalable", async () => {
  const [manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  const parsedManifest = JSON.parse(manifest);

  assert.equal(parsedManifest.name, "La Justa");
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.lang, "es-CL");
  assert.equal(parsedManifest.icons.length, 2);
  assert.match(serviceWorker, /la-justa-v5/);
  assert.match(serviceWorker, /icon-180\.png/);
  assert.match(serviceWorker, /Sin conexión/);
});
