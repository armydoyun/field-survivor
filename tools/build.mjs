// npm run build → deploy/index.html : HTML · CSS · JS를 모두 담은 한 파일짜리 오프라인 배포본.
// file://로 더블클릭해 열어도 동작한다(인라인 classic script라 ES Module의 CORS 제한이 없다).
// 진입점은 src/main.js 하나다. debug.html·src/debug/·tests/·tools/·visual-review/는 배포본에 들어가지 않는다.
//
//   node tools/build.mjs                 deploy/index.html을 만든다 (deploy/는 git에 올리지 않는다)
//   node tools/build.mjs --out=a.html    다른 곳에 만든다
import { build as esbuild, transform } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inlineHtml } from "./inline-html.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOY = path.join(ROOT, "deploy");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

export const JS_OPTIONS = Object.freeze({
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2022",
  charset: "utf8",
  legalComments: "none",
  banner: { js: `/*! FIELD SURVIVOR v${VERSION} */\n"use strict";` },
});
export const CSS_OPTIONS = Object.freeze({ loader: "css", minify: true, charset: "utf8" });

export const build = async ({ outFile = path.join(DEPLOY, "index.html") } = {}) => {
  const bundle = await esbuild({
    ...JS_OPTIONS,
    entryPoints: [path.join(ROOT, "src", "main.js")],
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  const inputs = Object.keys(bundle.metafile.inputs);
  const debugInputs = inputs.filter(file => file.startsWith("src/debug/"));
  if (debugInputs.length) throw new Error(`배포본에 개발 실험실 모듈이 섞였습니다: ${debugInputs.join(", ")}`);
  const js = bundle.outputFiles[0].text;
  const css = (await transform(fs.readFileSync(path.join(ROOT, "style.css"), "utf8"), CSS_OPTIONS)).code;
  const html = inlineHtml({ html: fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), css, js });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  return {
    outFile,
    modules: inputs.length,
    bytes: Buffer.byteLength(html),
    jsBytes: Buffer.byteLength(js),
    cssBytes: Buffer.byteLength(css),
  };
};

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const out = process.argv.find(a => a.startsWith("--out="))?.slice(6);
  const kb = n => `${(n / 1024).toFixed(0)} KB`;
  try {
    const result = await build(out ? { outFile: path.resolve(out) } : {});
    console.log(
      `${path.relative(ROOT, result.outFile)}: ${kb(result.bytes)} (모듈 ${result.modules}개 · JS ${kb(result.jsBytes)} · CSS ${kb(result.cssBytes)})`
    );
  } catch (error) {
    console.error(
      error.errors?.length
        ? error.errors.map(e => `${e.location?.file || ""}:${e.location?.line || ""} ${e.text}`).join("\n")
        : error.message
    );
    process.exit(1);
  }
}
