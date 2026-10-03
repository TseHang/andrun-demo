import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

test("slugify Hello World", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});
