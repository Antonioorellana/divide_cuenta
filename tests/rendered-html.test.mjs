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
  assert.match(html, /Tomar foto/);
  assert.match(html, /Elegir desde Fotos/);
  assert.match(html, /La foto se procesa en tu dispositivo/);
  assert.match(
    html,
    /<link[^>]+rel="icon"[^>]+href="(?:https?:\/\/[^"/]+)?\/la-justa-favicon-32\.png"/,
  );
  assert.match(
    html,
    /<link[^>]+rel="apple-touch-icon"[^>]+href="(?:https?:\/\/[^"/]+)?\/la-justa-apple-180\.png"/,
  );
  assert.match(
    html,
    /Desarrollado por(?:\s*<!-- -->)?\s*<strong>Orvedevs<\/strong>\s*· Versión 1\.03/,
  );
  assert.doesNotMatch(html, /\bPiloto\b/i);
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
  assert.deepEqual(
    parsedManifest.icons.map(({ sizes, purpose }) => [sizes, purpose]),
    [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]],
  );
  assert.match(serviceWorker, /la-justa-v8/);
  assert.match(serviceWorker, /bar-hero\.webp/);
  assert.match(serviceWorker, /consumption-photos\.webp/);
  for (const { src } of parsedManifest.icons) {
    assert.ok(serviceWorker.includes(src));
  }
  assert.match(serviceWorker, /la-justa-apple-180\.png/);
  assert.match(serviceWorker, /Sin conexión/);
});
