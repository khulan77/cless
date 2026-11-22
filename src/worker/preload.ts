/**
 * Worker-ийн bun preload (Next-ээс гадуур ажилладаг тул):
 *
 * 1. `server-only` нь "react-server" condition-гүй үед import хийхэд throw хийдэг, харин
 *    тэр condition нь react-dom/server (React Email)-ийг эвддэг → хоосон модуль болгон ачаална.
 * 2. Bun 1.3.11 нь React 19.3-ийн react-dom/server-ийн PRODUCTION CJS build-уудыг ачаалж
 *    чаддаггүй ("Expected CommonJS module to have a function wrapper" — Bun-ийн bug).
 *    Тиймээс зөвхөн react-dom/server-ийг development build руу чиглүүлнэ (имэйл render-д
 *    хангалттай). TODO: Bun шинэчлэгдсэний дараа энэ хэсгийг устгаж шалгах.
 */
import { plugin } from "bun";

plugin({
  name: "worker-compat",
  setup(build) {
    build.onLoad({ filter: /[\\/]server-only[\\/]index\.js$/ }, () => ({ contents: "export {};", loader: "js" }));
    build.onLoad({ filter: /[\\/]react-dom[\\/]server\.bun\.js$/ }, () => ({
      loader: "js",
      // Plugin-ийн агуулгыг Bun ESM гэж үздэг тул ESM-ээр re-export хийнэ
      contents: `import b from "./cjs/react-dom-server.bun.development.js";
import l from "./cjs/react-dom-server-legacy.browser.development.js";
export const version = b.version;
export const renderToReadableStream = b.renderToReadableStream;
export const renderToPipeableStream = b.renderToPipeableStream;
export const resumeToPipeableStream = b.resumeToPipeableStream;
export const resume = b.resume;
export const renderToString = l.renderToString;
export const renderToStaticMarkup = l.renderToStaticMarkup;
export default { version, renderToReadableStream, renderToPipeableStream, resumeToPipeableStream, resume, renderToString, renderToStaticMarkup };`,
    }));
  },
});
