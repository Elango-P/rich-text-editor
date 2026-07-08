# react-lite-rich-text-editor

A **premium, zero-dependency** rich text editor for React — tables, image resize, video embeds, markdown shortcuts, and clean HTML output.

<div align="center">

[![Live Demo](https://img.shields.io/badge/TRY%20IT-LIVE%20DEMO-blueviolet?style=for-the-badge&logo=rocket)](https://elangodev.com/npm)
[![npm version](https://img.shields.io/npm/v/react-lite-rich-text-editor?style=for-the-badge)](https://www.npmjs.com/package/react-lite-rich-text-editor)
[![npm downloads](https://img.shields.io/npm/dm/react-lite-rich-text-editor?style=for-the-badge)](https://www.npmjs.com/package/react-lite-rich-text-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**[Live Demo](https://elangodev.com/npm)** · **[npm](https://www.npmjs.com/package/react-lite-rich-text-editor)** · **[GitHub](https://github.com/Elango-P/rich-text-editor)**

</div>

---

## Why this editor?

Most React editors pull in Quill, Draft.js, or TipTap and a pile of plugins. This one does not.

| | react-lite-rich-text-editor |
| :--- | :--- |
| Runtime dependencies | **Zero** (native browser APIs) |
| API surface | One controlled component |
| Output | Clean HTML |
| Tables / images / video | Built in |
| Markdown shortcuts | Built in |

Perfect for bios, CMS fields, comments, and notes where you want a real toolbar without a framework inside your framework.

## Install

```bash
npm install react-lite-rich-text-editor
```

## Quick start

```jsx
import React, { useState } from 'react';
import { RichTextEditor } from 'react-lite-rich-text-editor';

function App() {
  const [content, setContent] = useState('');

  return (
    <RichTextEditor
      label="Biography"
      value={content}
      onChange={(value) => setContent(value)}
      placeholder="Tell us your story..."
    />
  );
}
```

## Try it out

- **Live demo**: [elangodev.com/npm](https://elangodev.com/npm) — interactive playground with sample content
- **Local preview**: clone this repo, then run `npm install && npm run dev` inside `example/`

## Features

- **Undo / redo** — full history stack with toolbar buttons and keyboard shortcuts
- **Slash commands** — type `/` for a Notion-style command menu (headings, lists, media, divider)
- **Strikethrough** — toolbar button plus `Ctrl/Cmd + Shift + X`
- **Zero-dependency core** — native browser APIs for performance and stability
- **Advanced tables** — insert tables, add/delete rows and columns, merge cells
- **Universal video embedding** — YouTube, Vimeo, DailyMotion, and more
- **Image resizing** — interactive 4-handle resize for uploaded images
- **Content metrics** — live word and character counts in the footer
- **Rich formatting** — bold, italic, underline, font sizes, colors, alignment, lists
- **Heading styles** — Paragraph, H1–H3, and Quote from the toolbar
- **Clear formatting** — one click to strip styles, links, and reset to a paragraph
- **Markdown shortcuts** — `#`, `##`, `###`, `>`, `-`, `*`, or `1.` then Space
- **Placeholder support** — hint text when the editor is empty
- **Smart links** — automatic protocol handling and new-window navigation
- **Premium UI** — modern, glassmorphism-inspired design
- **Accessible** — `role="textbox"` and `aria-label` on the editable region

## Text styles

| Style | Toolbar option |
| :--- | :--- |
| Normal text | Paragraph |
| Large title | Heading 1 |
| Section title | Heading 2 |
| Subsection title | Heading 3 |
| Quoted text | Quote |

Use the **Tx** button to clear formatting from the current selection.

## Markdown shortcuts

Type these at the start of a line, then press **Space**:

| Shortcut | Result |
| :--- | :--- |
| `#` + Space | Heading 1 |
| `##` + Space | Heading 2 |
| `###` + Space | Heading 3 |
| `>` + Space | Quote |
| `-` or `*` + Space | Bullet list |
| `1.` + Space | Numbered list |

**Example:** type `## My Title` and press Space — it becomes a Heading 2.

## Slash commands

Type `/` at the start of a line (or after a space) to open the command menu:

| Command | Result |
| :--- | :--- |
| `/h1`, `/heading` | Heading 1 |
| `/h2` | Heading 2 |
| `/quote` | Block quote |
| `/bullet` | Bullet list |
| `/table` | Insert table |
| `/image` | Upload image |
| `/video` | Embed video |
| `/link` | Insert link |
| `/divider` | Horizontal rule |

Use **↑↓** to navigate, **Enter** to insert, **Esc** to close.

## Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + U` | Underline |
| `Ctrl/Cmd + Shift + X` | Strikethrough |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo |
| `/` | Open slash command menu |
| `Enter` | New paragraph or list item |
| `Escape` | Close image zoom modal |

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | `""` | Label displayed above the editor. |
| `value` | `string` | `""` | The HTML content of the editor. |
| `onChange` | `function` | `undefined` | Callback on content change. |
| `placeholder` | `string` | `"Type here..."` | Placeholder when empty. |
| `editable` | `boolean` | `true` | Set `false` for a read-only viewer. |
| `disabled` | `boolean` | `false` | Disables the editor and hides the toolbar. |
| `showBorder` | `boolean` | `true` | Controls border and shadow visibility. |
| `minHeight` | `string \| number` | `"150px"` | Minimum height of the content area. |
| `maxHeight` | `string \| number` | `"500px"` | Maximum height of the content area. |
| `onImageUpload` | `function` | `undefined` | Custom image upload handler; return `Promise<string>` URL. |

## Development

```bash
npm run build
```

Output is written to `dist/`.

## License

MIT © [Elango](https://github.com/Elango-P)
