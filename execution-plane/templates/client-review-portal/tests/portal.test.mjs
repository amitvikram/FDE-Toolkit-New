import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("portal exposes the review workflow", () => {
  assert.match(html, /Exception Review Portal/);
  assert.match(html, /Reviewer decision/);
  assert.match(html, /Human review required/);
});

test("portal has responsive product styling", () => {
  assert.match(css, /@media/);
  assert.match(css, /grid-template-columns/);
});
