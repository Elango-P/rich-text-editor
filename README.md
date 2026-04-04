# React Lite Rich Text Editor

A **premium, zero-dependency**, and industry-standard rich text editor for React.

<div align="center">
  <a href="https://elangodev.com/npm">
    <img src="https://img.shields.io/badge/TRY%20IT-LIVE%20DEMO-blueviolet?style=for-the-badge&logo=rocket" alt="Try it out" />
  </a>
  <a href="https://www.npmjs.com/package/react-lite-rich-text-editor">
    <img src="https://img.shields.io/npm/v/react-lite-rich-text-editor?style=for-the-badge" alt="NPM Version" />
  </a>
  <a href="https://codesandbox.io/s/github/Elango-P/rich-text-editor/tree/main/example">
    <img src="https://img.shields.io/badge/TRY%20IT-SANDBOX-orange?style=for-the-badge&logo=codesandbox" alt="CodeSandbox" />
  </a>
</div>

---

## Try it Out

- **Live Demo**: [Industrial Rich Text Editor Demo](https://elangodev.com/npm)
- **Interactive Sandbox**: [Open in CodeSandbox](https://codesandbox.io/s/github/Elango-P/rich-text-editor/tree/main/example)
- **Local Preview**: Clone this repo and run `npm install && npm run dev` inside the `example/` folder.

---

## Features

-   ✨ **Zero-Dependency Core**: Built entirely with native Browser APIs for maximum performance and stability.
-   📊 **Advanced Tables**: Insert tables, add/delete rows/columns, and merge cells with intuitive toolbar controls.
-   🎥 **Universal Video Embedding**: Seamlessly embed videos from **YouTube, Vimeo, DailyMotion**, and more.
-   📏 **Image Resizing**: Interactive 4-handle resizing system for uploaded images.
-   🧮 **Content Metrics**: Stealthy, professional footer showing real-time **Word and Character counts**.
-   📝 **Rich Formatting**: Bold, italic, underline, font sizes, colors, alignment, and lists.
-   🔗 **Smart Links**: Automatic protocol handling and new window navigation.
-   🎨 **Premium UI**: Modern, glassmorphism-inspired design with a polished Look & Feel.

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

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | `""` | Label displayed above the editor. |
| `value` | `string` | `""` | The HTML content of the editor. |
| `onChange` | `function` | `undefined` | Callback function triggered on content change. |
| `placeholder` | `string` | `"Type here..."` | Placeholder text when empty. |
| `disabled` | `boolean` | `false` | Disables the editor and hides the toolbar. |
| `showBorder` | `boolean` | `true` | Controls the visibility of the editor's border and shadow. |
| `onImageUpload` | `function` | `undefined` | Custom handler for image uploads. |

## Development & Build

To build the project for production:

```bash
npm run build
```

The output will be generated in the `dist/` directory.

## License

MIT © [Elango](https://github.com/Elango-P)
