// npm run test:build → 배포본을 임시 폴더에 빌드하고, 실제 Chromium에서 file://로 열어 게임이 뜨고 진행되는지 본다.
// 확인하는 것: 페이지 오류·콘솔 오류 0개, 바깥 파일 요청 0개, 새 게임 시작 후 경과 시간이 흐르고 이동 키로 화면이 바뀜.
// 실패하면 test-results/build/에 스크린샷을 남긴다(CI가 Artifacts로 올린다).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { build, ROOT } from "./build.mjs";

const RESULTS = path.join(ROOT, "test-results", "build");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "field-survivor-build-"));
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "ok" : "not ok"} - ${message}`);
  if (!ok) failures.push(message);
};

let browser;
let page;
try {
  const { outFile, bytes } = await build({ outFile: path.join(directory, "index.html") });
  check(bytes > 0, `빌드 ${(bytes / 1024).toFixed(0)} KB`);
  const url = pathToFileURL(outFile).href;

  // CHROMIUM_PATH: Playwright가 받은 브라우저 대신 이미 설치된 Chromium을 쓸 때(로컬 전용). CI는 비워 둔다.
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => message.type() === "error" && errors.push(`console: ${message.text()}`));
  page.on(
    "request",
    request => request.url() !== url && !request.url().startsWith("data:") && requests.push(request.url())
  );

  await page.goto(url, { waitUntil: "load" });
  const newGame = page.locator('#overlay [data-action="new"]');
  await newGame.waitFor({ state: "visible", timeout: 5000 });
  check(true, "제목 화면에 새 게임 버튼이 보인다");

  await newGame.click();
  await page.locator("#field").focus();
  const timeBefore = await page.locator("#hudTime").textContent();
  const frameBefore = await page.locator("#field").screenshot();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(2200);
  await page.keyboard.up("KeyD");
  const timeAfter = await page.locator("#hudTime").textContent();
  const frameAfter = await page.locator("#field").screenshot();
  check(timeAfter !== timeBefore, `경과 시간이 흐른다 (${timeBefore} → ${timeAfter})`);
  check(!frameBefore.equals(frameAfter), "이동 후 Canvas 화면이 바뀐다");

  check(errors.length === 0, `페이지·콘솔 오류 없음${errors.length ? `\n  ${errors.join("\n  ")}` : ""}`);
  check(requests.length === 0, `바깥 파일 요청 없음${requests.length ? `\n  ${requests.join("\n  ")}` : ""}`);
} catch (error) {
  check(false, `예외: ${error.stack || error.message}`);
} finally {
  if (failures.length && page) {
    fs.mkdirSync(RESULTS, { recursive: true });
    await page.screenshot({ path: path.join(RESULTS, "failure.png") }).catch(() => {});
  }
  await browser?.close();
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log(failures.length ? `\n# fail ${failures.length}` : "\n# pass");
process.exit(failures.length ? 1 : 0);
