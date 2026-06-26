import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import {
  describeImageBuffers,
  type DescriptionMap,
  type ImageInput,
} from "./image-description";

const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type DocxMarkdownResult = {
  markdown: string;
  warnings: string[];
};

export type DocxToMarkdownOptions = {
  /** Default true: stuur images door Claude vision. Set op false om te skippen. */
  includeImages?: boolean;
};

/**
 * Converteert een .docx naar markdown via mammoth. Wanneer includeImages
 * (default true) zijn images via convertImage onderschept, in een vision-batch
 * beschreven, en hun placeholders in de markdown vervangen door
 * "[Logo: …]" / "[Foto: …]" achtigen.
 */
export async function docxToMarkdown(
  buffer: Buffer,
  options: DocxToMarkdownOptions = {}
): Promise<DocxMarkdownResult> {
  const includeImages = options.includeImages !== false;
  const images: ImageInput[] = [];
  const placeholderByKey = new Map<string, string>();

  type MammothImage = {
    read(): Promise<Buffer>;
    contentType: string;
  };

  const convertOptions = includeImages
    ? {
        convertImage: (mammoth as unknown as {
          images: { imgElement(fn: (img: MammothImage) => Promise<{ src: string }>): unknown };
        }).images.imgElement(async (image: MammothImage) => {
          const mimeType = image.contentType;
          const placeholderId = randomUUID().replace(/-/g, "");
          const placeholder = `__IMG_PH_${placeholderId}__`;
          if (SUPPORTED_MIME.has(mimeType)) {
            const buf = await image.read();
            images.push({ key: placeholder, buffer: buf, mimeType });
            placeholderByKey.set(placeholder, placeholder);
          } else {
            // Niet-ondersteunde formaten (SVG, EMF, WMF, …) — placeholder zonder vision.
            placeholderByKey.set(placeholder, placeholder);
          }
          return { src: placeholder };
        }),
      }
    : {};

  const result = await mammoth.convertToMarkdown({
    buffer,
    ...(convertOptions as Record<string, unknown>),
  });

  let md = result.value.trim();
  if (!md) throw new Error("DOCX bevat geen tekst (of is beschadigd)");

  if (includeImages && placeholderByKey.size > 0) {
    let descriptions: DescriptionMap = new Map();
    try {
      descriptions = await describeImageBuffers(images);
    } catch {
      // Vision-batch helemaal mislukt — laat descriptions leeg.
    }
    for (const placeholder of placeholderByKey.keys()) {
      const desc = descriptions.get(placeholder) ?? "";
      // Mammoth schrijft images als `![alt](src)`. Vervang de hele
      // image-syntax + de losse placeholder voor de zekerheid.
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      md = md
        .replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "g"), desc)
        .split(placeholder)
        .join(desc);
    }
    md = md.replace(/\n{3,}/g, "\n\n").trim();
  }

  return {
    markdown: md,
    warnings: result.messages.map((m) => m.message),
  };
}
