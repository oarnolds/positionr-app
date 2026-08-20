import { describe, it, expect } from "vitest";
import { sanitizeRich } from "./sanitize";

describe("sanitizeRich", () => {
  it("laat toegestane tags staan", () => {
    const out = sanitizeRich("<p>Hallo <strong>wereld</strong></p>");
    expect(out).toBe("<p>Hallo <strong>wereld</strong></p>");
  });

  it("strip script-tags volledig", () => {
    const out = sanitizeRich("<p>Ok</p><script>alert(1)</script>");
    expect(out).toBe("<p>Ok</p>");
    expect(out).not.toContain("script");
  });

  it("strip event-handlers op links", () => {
    const out = sanitizeRich('<a href="/x" onclick="steal()">klik</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="/x"');
  });

  it("strip javascript:-href", () => {
    const out = sanitizeRich('<a href="javascript:alert(1)">klik</a>');
    expect(out).not.toContain("javascript:");
  });

  it("laat lijst-tags toe", () => {
    const out = sanitizeRich("<ul><li>een</li><li>twee</li></ul>");
    expect(out).toBe("<ul><li>een</li><li>twee</li></ul>");
  });

  it("laat cursief en bold toe", () => {
    const out = sanitizeRich("<p><em>schuin</em> en <strong>vet</strong></p>");
    expect(out).toBe("<p><em>schuin</em> en <strong>vet</strong></p>");
  });

  it("strip iframe volledig", () => {
    const out = sanitizeRich('<p>Ok</p><iframe src="//evil.com"></iframe>');
    expect(out).not.toContain("iframe");
    expect(out).toContain("<p>Ok</p>");
  });

  it("laat http-links toe met href intact", () => {
    const out = sanitizeRich('<a href="https://example.com">klik</a>');
    expect(out).toBe('<a href="https://example.com">klik</a>');
  });
});
