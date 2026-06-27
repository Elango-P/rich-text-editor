# React Lite Rich Text Editor

A **premium, zero-dependency**, and industry-standard rich text editor for React.

<div align="center">
  <a href="https://elangodev.com/npm">
    <img src="https://img.shields.io/badge/TRY%20IT-LIVE%20DEMO-blueviolet?style=for-the-badge&logo=rocket" alt="Try it out" />
  </a>
  <a href="https://www.npmjs.com/package/react-lite-rich-text-editor">
    <img src="https://img.shields.io/npm/v/react-lite-rich-text-editor?style=for-the-badge" alt="NPM Version" />
  </a>
</div>

---

## Try it Out

- **Live Demo**: [Industrial Rich Text Editor Demo](https://elangodev.com/npm)
- **Local Preview**: Clone this repo and run `npm install && npm run dev` inside the `example/` folder.

---

## Features

-   ✨ **Zero-Dependency Core**: Built entirely with native Browser APIs for maximum performance and stability.
-   📊 **Advanced Tables**: Insert tables, add/delete rows/columns, and merge cells with intuitive toolbar controls.
-   🎥 **Universal Video Embedding**: Seamlessly embed videos from **YouTube, Vimeo, DailyMotion**, and more.
-   📏 **Image Resizing**: Interactive 4-handle resizing system for uploaded images.
-   🧮 **Content Metrics**: Stealthy, professional footer showing real-time **Word and Character counts**.
-   📝 **Rich Formatting**: Bold, italic, underline, font sizes, colors, alignment, and lists.
-   📑 **Heading Styles**: Built-in dropdown for Paragraph, Heading 1, Heading 2, Heading 3, and Quote.
-   🧹 **Clear Formatting**: One-click button to remove styles, links, and reset text to a clean paragraph.
-   ⚡ **Markdown Shortcuts**: Type `#`, `##`, `###`, `>`, `-`, `*`, or `1.` then press Space to format instantly.
-   💬 **Placeholder Support**: Show helpful hint text when the editor is empty.
-   🔗 **Smart Links**: Automatic protocol handling and new window navigation.
-   🎨 **Premium UI**: Modern, glassmorphism-inspired design with a polished Look & Feel.
-   ♿ **Accessible**: Editable region includes `role="textbox"` and `aria-label` support.

## Installation

```bash
npm install react-lite-rich-text-editor
```

## Basic Usage

```jsx
import React, { useState } from 'react';
import { RichTextEditor } from 'react-lite-rich-text-editor';

function App() {
  const [content, setContent] = useState('');

  return (
    <div className="p-8">
      <RichTextEditor
        label="Biography"
        value={content}
        onChange={(value) => setContent(value)}
        placeholder="Tell us your story..."
      />
    </div>
  );
}
```

## Text Styles

Use the **Paragraph / Heading / Quote** dropdown in the toolbar to change block formatting:

| Style | Toolbar Option |
| :--- | :--- |
| Normal text | Paragraph |
| Large title | Heading 1 |
| Section title | Heading 2 |
| Subsection title | Heading 3 |
| Quoted text | Quote |

Use the **Tx** button to clear formatting from the current selection — removes bold, italic, underline, colors, links, and resets the block to a paragraph.

## Markdown Shortcuts

Type these at the start of a line, then press **Space** to convert instantly:

| Shortcut | Result |
| :--- | :--- |
| `#` + Space | Heading 1 |
| `##` + Space | Heading 2 |
| `###` + Space | Heading 3 |
| `>` + Space | Quote |
| `-` or `*` + Space | Bullet list |
| `1.` + Space | Numbered list |

**Example:** Type `## My Title` and press Space — it becomes a Heading 2.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + U` | Underline |
| `Enter` | New paragraph or list item |
| `Escape` | Close image zoom modal |

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | `""` | Label displayed above the editor. |
| `value` | `string` | `""` | The HTML content of the editor. |
| `onChange` | `function` | `undefined` | Callback function triggered on content change. |
| `placeholder` | `string` | `"Type here..."` | Placeholder text when empty. |
| `editable` | `boolean` | `true` | Whether the editor is editable. Set to `false` for a read-only viewer. |
| `disabled` | `boolean` | `false` | Disables the editor and hides the toolbar. |
| `showBorder` | `boolean` | `true` | Controls the visibility of the editor's border and shadow. |
| `minHeight` | `string \| number` | `"150px"` | Minimum height of the editor content area. |
| `maxHeight` | `string \| number` | `"500px"` | Maximum height of the editor content area. |
| `onImageUpload` | `function` | `undefined` | Custom handler for image uploads. Should return a `Promise<string>` URL. |

## Development & Build

To build the project for production:

```bash
npm run build
```

The output will be generated in the `dist/` directory.

## License

MIT © [Elango](https://github.com/Elango-P)
