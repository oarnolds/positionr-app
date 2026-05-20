import { test, expect } from "vitest";
import { MODULE_SLUG } from "./index";

test("MODULE_SLUG = 'website-check'", () => {
  expect(MODULE_SLUG).toBe("website-check");
});
