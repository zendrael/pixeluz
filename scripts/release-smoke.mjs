import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const root = fileURLToPath(new URL("..", import.meta.url));
const port = 4173;
const origin = `http://127.0.0.1:${port}/`;
const chrome = process.env.CHROME_PATH
  ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);

const preview = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});
let previewLog = "";
preview.stdout.on("data", (chunk) => {
  previewLog += chunk.toString();
});
preview.stderr.on("data", (chunk) => {
  previewLog += chunk.toString();
});

const failures = [];
const errors = [];

function fail(message) {
  failures.push(message);
}

async function waitForPreview() {
  const started = Date.now();
  while (!previewLog.includes("4173") && Date.now() - started < 20000) {
    if (preview.exitCode !== null) break;
    await delay(100);
  }
  if (!previewLog.includes("4173")) {
    throw new Error(previewLog || "vite preview não subiu");
  }
}

async function spritePoint(page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.sprite-canvas");
    const zoom = Number.parseInt(document.querySelector("#status-zoom")?.textContent ?? "", 10);
    if (!(canvas instanceof HTMLCanvasElement) || !Number.isInteger(zoom)) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    const letter = image.data;
    const same = (index) => letter[index] === letter[0] && letter[index + 1] === letter[1] && letter[index + 2] === letter[2];
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        if (!same(index)) return { x: x / dpr + zoom / 2, y: y / dpr + zoom / 2, zoom };
      }
    }
    return null;
  });
  if (!point) throw new Error("não achei o sprite no canvas");
  const box = await page.locator("canvas.sprite-canvas").boundingBox();
  if (!box) throw new Error("canvas sem caixa");
  return { box, point };
}

async function paintOrigin(page) {
  const target = await spritePoint(page);
  await page.mouse.click(target.box.x + target.point.x, target.box.y + target.point.y);
  return target;
}

async function pixelAt(page, target) {
  return page.evaluate(({ cssX, cssY }) => {
    const canvas = document.querySelector("canvas.sprite-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const dpr = window.devicePixelRatio || 1;
    const image = context.getImageData(Math.floor(cssX * dpr), Math.floor(cssY * dpr), 1, 1);
    return [...image.data];
  }, { cssX: target.point.x, cssY: target.point.y });
}

function isBlack(pixel) {
  return pixel && pixel[0] < 12 && pixel[1] < 12 && pixel[2] < 12 && pixel[3] > 200;
}

async function waitForEditor(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas.sprite-canvas");
    const zoom = document.querySelector("#status-zoom")?.textContent ?? "";
    return canvas instanceof HTMLCanvasElement && canvas.width > 10 && /^\d+×$/.test(zoom);
  });
}

async function editorReady(page) {
  await page.goto(origin, { waitUntil: "networkidle" });
  await waitForEditor(page);
}

async function rememberSprite(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => document.querySelector("#status-doc")?.textContent?.includes("Salvo") && !document.querySelector("#status-doc")?.textContent?.includes("Não salvo"));
}

async function drawAndReload(page) {
  const notice = page.locator("#browser-notice");
  if ((await notice.textContent()) !== "Neste navegador até Baixar o projeto.") {
    fail("o aviso de navegador não apareceu ao abrir");
  }
  const target = await paintOrigin(page);
  await page.waitForTimeout(80);
  if (!isBlack(await pixelAt(page, target))) fail("o pixel pintado não ficou preto");
  await page.locator("#btn-undo").click();
  await page.waitForTimeout(80);
  if (isBlack(await pixelAt(page, target))) fail("desfazer não removeu o pixel");
  await paintOrigin(page);
  await page.waitForTimeout(80);
  if (!isBlack(await pixelAt(page, await spritePoint(page)))) fail("pintar de novo não ficou preto");
  await rememberSprite(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForEditor(page);
  if (!isBlack(await pixelAt(page, await spritePoint(page)))) fail("o pixel sumiu depois de recarregar");
}

try {
  await waitForPreview();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await desktop.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await editorReady(page);
  await drawAndReload(page);

  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
    window.showOpenFilePicker = undefined;
  });
  const [project] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#btn-download").click(),
  ]);
  if (!project.suggestedFilename().endsWith(".pixeluz.json")) fail(`download inesperado: ${project.suggestedFilename()}`);
  await page.waitForFunction(() => document.querySelector("#browser-notice")?.hidden === true);
  const shifted = await page.evaluate(() => {
    const zoom = Number.parseInt(document.querySelector("#status-zoom")?.textContent ?? "", 10);
    const canvas = document.querySelector("canvas.sprite-canvas");
    const context = canvas.getContext("2d");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    const letter = image.data;
    const same = (index) => letter[index] === letter[0] && letter[index + 1] === letter[1] && letter[index + 2] === letter[2];
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        if (!same(index)) return { x: x / dpr + zoom * 1.5, y: y / dpr + zoom / 2 };
      }
    }
    return null;
  });
  const box = await page.locator("canvas.sprite-canvas").boundingBox();
  await page.mouse.click(box.x + shifted.x, box.y + shifted.y);
  await page.waitForFunction(() => document.querySelector("#browser-notice")?.hidden === false);

  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const [png] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-action='export']").click(),
  ]);
  if (!png.suggestedFilename().endsWith(".png")) fail(`png inesperado: ${png.suggestedFilename()}`);
  const bytes = await png.path().then((path) => require("node:fs").readFileSync(path));
  const first = await page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, Buffer.from(bytes).toString("base64"));
  if (!isBlack(first)) fail(`primeiro pixel do PNG: ${first.join(",")}`);

  await page.evaluate(() => navigator.serviceWorker.ready);
  await desktop.setOffline(true);
  await page.goto(`${origin}offline.html`, { waitUntil: "domcontentloaded" });
  const offline = await page.locator("body").innerText();
  if (!offline.includes("ainda não está disponível offline")) fail("a página offline não apareceu");
  await desktop.setOffline(false);

  const mobile = await browser.newContext({ viewport: { width: 390, height: 800 }, acceptDownloads: true });
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => errors.push(String(error)));
  await editorReady(phone);
  await drawAndReload(phone);

  await browser.close();
} catch (error) {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  preview.kill("SIGTERM");
}

if (errors.length) fail(`erros de página: ${errors.join("\n")}`);
if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log("smoke ok");
