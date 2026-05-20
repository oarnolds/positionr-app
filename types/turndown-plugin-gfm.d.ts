// Manual type-declaratie omdat turndown-plugin-gfm geen eigen types levert.
// We gebruiken alleen `gfm` als plugin-functie voor TurndownService.use().

declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  export function gfm(turndownService: TurndownService): void;
  export function tables(turndownService: TurndownService): void;
  export function strikethrough(turndownService: TurndownService): void;
  export function taskListItems(turndownService: TurndownService): void;
}
