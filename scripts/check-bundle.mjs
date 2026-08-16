import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const DIST = path.resolve("dist");
const INITIAL_LIMIT = 200 * 1024;
const CHUNK_LIMIT = 150 * 1024;
const RAW_CHUNK_LIMIT = 500 * 1024;
const PRECACHE_LIMIT = 3 * 1024 * 1024;

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(fullPath));
    else result.push(fullPath);
  }
  return result;
}

const files = await filesUnder(DIST);
const javascript = files.filter((file) => file.endsWith(".js") && path.basename(file) !== "sw.js");
const html = await readFile(path.join(DIST, "index.html"), "utf8");
const initialNames = new Set([...html.matchAll(/(?:src|href)="\/([^"?]+\.js)"/g)].map((match) => match[1]));
const initialFiles = javascript.filter((file) => initialNames.has(path.relative(DIST, file).replaceAll("\\", "/")));

const chunks = await Promise.all(javascript.map(async (file) => {
  const content = await readFile(file);
  return {
    name: path.relative(DIST, file).replaceAll("\\", "/"),
    raw: content.length,
    gzip: gzipSync(content).length,
  };
}));
const initialGzip = chunks.filter((chunk) => initialFiles.some((file) => chunk.name === path.relative(DIST, file).replaceAll("\\", "/")))
  .reduce((total, chunk) => total + chunk.gzip, 0);
const precacheExtensions = new Set([".html", ".js", ".css", ".woff", ".woff2", ".svg", ".png", ".ico"]);
let precacheBytes = 0;
for (const file of files) {
  if (precacheExtensions.has(path.extname(file)) && path.basename(file) !== "sw.js") precacheBytes += (await stat(file)).size;
}

const errors = [];
if (initialGzip > INITIAL_LIMIT) errors.push(`Initial JavaScript ${initialGzip} bytes exceeds ${INITIAL_LIMIT}`);
for (const chunk of chunks) {
  if (chunk.gzip > CHUNK_LIMIT) errors.push(`${chunk.name} gzip ${chunk.gzip} bytes exceeds ${CHUNK_LIMIT}`);
  if (chunk.raw > RAW_CHUNK_LIMIT) errors.push(`${chunk.name} raw ${chunk.raw} bytes exceeds ${RAW_CHUNK_LIMIT}`);
}
if (precacheBytes > PRECACHE_LIMIT) errors.push(`Precache candidate assets ${precacheBytes} bytes exceeds ${PRECACHE_LIMIT}`);

console.log(JSON.stringify({ initialGzip, precacheBytes, chunks }, null, 2));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
