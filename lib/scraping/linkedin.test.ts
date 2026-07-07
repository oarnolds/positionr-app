import { test, expect } from "vitest";
import { normalizeLinkedInCompanyUrl, isLinkedInAuthwall } from "./linkedin";

test("normalizeLinkedInCompanyUrl: admin-dashboard-URL → publieke bedrijfspagina", () => {
  expect(
    normalizeLinkedInCompanyUrl(
      "https://www.linkedin.com/company/104954097/admin/dashboard",
    ),
  ).toBe("https://www.linkedin.com/company/104954097");
});

test("normalizeLinkedInCompanyUrl: strip /posts, query en trailing slash", () => {
  expect(
    normalizeLinkedInCompanyUrl(
      "https://www.linkedin.com/company/eclectik/posts/?feedView=all",
    ),
  ).toBe("https://www.linkedin.com/company/eclectik");
  expect(
    normalizeLinkedInCompanyUrl("https://www.linkedin.com/company/eclectik/"),
  ).toBe("https://www.linkedin.com/company/eclectik");
});

test("normalizeLinkedInCompanyUrl: schone bedrijfspagina blijft gelijk", () => {
  expect(
    normalizeLinkedInCompanyUrl("https://www.linkedin.com/company/biqql"),
  ).toBe("https://www.linkedin.com/company/biqql");
});

test("normalizeLinkedInCompanyUrl: niet-company-URL blijft ongewijzigd", () => {
  expect(normalizeLinkedInCompanyUrl("https://biqql.com/over-ons")).toBe(
    "https://biqql.com/over-ons",
  );
});

test("isLinkedInAuthwall: inlogscherm herkend aan titel", () => {
  expect(
    isLinkedInAuthwall({
      title: "LinkedIn Login, Sign in | LinkedIn",
      markdown: "# Sign in\n\nStay updated on your professional world.",
    }),
  ).toBe(true);
});

test("isLinkedInAuthwall: inlogscherm herkend aan content-marker", () => {
  expect(
    isLinkedInAuthwall({
      title: null,
      markdown: "Iets\n\nStay updated on your professional world.\n\nSign in",
    }),
  ).toBe(true);
});

test("isLinkedInAuthwall: echte bedrijfspagina is geen authwall", () => {
  expect(
    isLinkedInAuthwall({
      title: "BIQQL | LinkedIn",
      markdown:
        "# BIQQL\n\n372 followers\n\nMicrosoft Power Platform Specialisten",
    }),
  ).toBe(false);
});
