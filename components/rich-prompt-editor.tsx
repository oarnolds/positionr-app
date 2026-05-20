// components/rich-prompt-editor.tsx
//
// TipTap-wrapper voor de admin prompt editor.
// - Bewaart waarde als Markdown (via turndown HTML→MD, marked MD→HTML)
// - Exposeert imperative handle voor placeholder-chips (insertText)
// - immediatelyRender=false vermijdt Next.js hydration-mismatch

"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useEffect, useRef } from "react";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
turndown.use(gfm);

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

async function markdownToHtml(md: string): Promise<string> {
  if (!md) return "";
  return await marked(md, { gfm: true, breaks: false });
}

export type RichPromptEditorHandle = {
  insertText: (text: string) => void;
};

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorRef?: React.MutableRefObject<RichPromptEditorHandle | null>;
}

export function RichPromptEditor({
  value,
  onChange,
  placeholder = "Voer de prompt in...",
  minHeight = 400,
  editorRef,
}: Props) {
  const lastEmittedValue = useRef(value);
  // Suppress de allereerste onUpdate-emit (en die na elke programmatische
  // setContent), zodat de MD→HTML→MD-roundtrip de dirty-state niet onnodig
  // triggert. Alleen écht gebruikersinput moet onChange aanroepen.
  const suppressNextEmit = useRef(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: "",
    onUpdate({ editor }) {
      if (suppressNextEmit.current) {
        suppressNextEmit.current = false;
        // Update baseline naar wat TipTap nu in z'n state heeft — dat is
        // de canonieke roundtrip-versie. Hieraan vergelijken we volgende
        // user-edits.
        lastEmittedValue.current = htmlToMarkdown(editor.getHTML());
        return;
      }
      const md = htmlToMarkdown(editor.getHTML());
      if (md !== lastEmittedValue.current) {
        lastEmittedValue.current = md;
        onChange(md);
      }
    },
    immediatelyRender: false,
  });

  // Wanneer `value` van buiten verandert (bv. module-wissel): herlaad content
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedValue.current) return;
    let cancelled = false;
    markdownToHtml(value).then((html) => {
      if (cancelled) return;
      suppressNextEmit.current = true;
      editor.commands.setContent(html);
      lastEmittedValue.current = value;
    });
    return () => {
      cancelled = true;
    };
  }, [value, editor]);

  // Imperatieve handle voor placeholder-chip-insert
  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
    };
    return () => {
      if (editorRef) editorRef.current = null;
    };
  }, [editor, editorRef]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border bg-white" style={{ minHeight }}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus:outline-none"
        style={{ minHeight: minHeight - 48 }}
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn =
    "rounded p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40";
  const active = "bg-purple-100 text-purple-700";
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 px-2 py-1.5">
      <button
        type="button"
        className={cn(btn, editor.isActive("bold") && active)}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive("italic") && active)}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive("underline") && active)}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </button>
      <Sep />
      <button
        type="button"
        className={cn(btn, editor.isActive("heading", { level: 1 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive("heading", { level: 2 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive("heading", { level: 3 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>
      <Sep />
      <button
        type="button"
        className={cn(btn, editor.isActive("bulletList") && active)}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive("orderedList") && active)}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered list"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <Sep />
      <button
        type="button"
        className={btn}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        aria-label="Insert table"
      >
        <TableIcon className="h-4 w-4" />
      </button>
      <Sep />
      <button
        type="button"
        className={cn(btn, editor.isActive({ textAlign: "left" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        aria-label="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive({ textAlign: "center" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        aria-label="Align center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn, editor.isActive({ textAlign: "right" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        aria-label="Align right"
      >
        <AlignRight className="h-4 w-4" />
      </button>
      <Sep />
      <button
        type="button"
        className={btn}
        onClick={() => editor.chain().focus().undo().run()}
        aria-label="Undo"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => editor.chain().focus().redo().run()}
        aria-label="Redo"
      >
        <Redo className="h-4 w-4" />
      </button>
    </div>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-gray-300" />;
}
