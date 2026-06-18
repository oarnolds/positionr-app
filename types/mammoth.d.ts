declare module "mammoth" {
  export type ConvertMessage = {
    type: "warning" | "error";
    message: string;
  };

  export type ConvertResult = {
    value: string;
    messages: ConvertMessage[];
  };

  export type ConvertInput =
    | { path: string }
    | { buffer: Buffer }
    | { arrayBuffer: ArrayBuffer };

  export function convertToMarkdown(input: ConvertInput): Promise<ConvertResult>;
  export function convertToHtml(input: ConvertInput): Promise<ConvertResult>;
  export function extractRawText(input: ConvertInput): Promise<ConvertResult>;
}
