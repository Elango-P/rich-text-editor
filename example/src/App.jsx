import { useState, useCallback } from 'react'
import { RichTextEditor } from 'react-lite-rich-text-editor'
import './App.css'

const DEMO_CONTENT = `
<h1>Write something worth reading</h1>
<p>This is a <strong>zero-dependency</strong> React rich text editor — no Quill, no Draft.js, no TipTap. Just a polished toolbar and clean HTML output.</p>
<blockquote>Try the toolbar, type <code>/</code> for slash commands, markdown shortcuts, tables, images, and video embeds. Everything below is editable.</blockquote>
<h2>What you can do</h2>
<ul>
  <li><strong>Format text</strong> — bold, italic, underline, colors, and alignment</li>
  <li><em>Markdown shortcuts</em> — type <code>##</code> then Space for a heading</li>
  <li>Insert <u>tables</u>, images with resize handles, and YouTube / Vimeo embeds</li>
</ul>
<h3>Quick table demo</h3>
<table>
  <thead>
    <tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>Zero dependencies</td><td>✅</td><td>Native browser APIs only</td></tr>
    <tr><td>Tables &amp; media</td><td>✅</td><td>Rows, columns, merge cells</td></tr>
    <tr><td>Word / char count</td><td>✅</td><td>Live metrics in the footer</td></tr>
  </tbody>
</table>
<p>Ready to use it in your app? Install with one command and drop in a single component.</p>
`.trim()

const FEATURES = [
  {
    title: 'Undo & redo',
    description: 'Full edit history with toolbar buttons plus Ctrl+Z / Ctrl+Shift+Z — expected in any modern editor.',
  },
  {
    title: 'Slash commands',
    description: 'Type / for a Notion-style menu — headings, lists, tables, images, video, links, and dividers.',
  },
  {
    title: 'Zero dependencies',
    description: 'Built on native browser APIs. No Quill, Draft.js, or TipTap — smaller installs and fewer surprises.',
  },
  {
    title: 'Tables & media',
    description: 'Insert tables, merge cells, resize images, and embed YouTube, Vimeo, or DailyMotion videos.',
  },
  {
    title: 'Markdown shortcuts',
    description: 'Type #, ##, >, -, or 1. then Space to format instantly — feels like a modern writing app.',
  },
  {
    title: 'Premium UI',
    description: 'Glassmorphism-inspired toolbar, strikethrough, content metrics, placeholders, and accessible textbox roles.',
  },
]

const INSTALL_CMD = 'npm install react-lite-rich-text-editor'

const USAGE_SNIPPET = `import { RichTextEditor } from 'react-lite-rich-text-editor'

function App() {
  const [content, setContent] = useState('')

  return (
    <RichTextEditor
      label="Biography"
      value={content}
      onChange={setContent}
      placeholder="Tell us your story..."
    />
  )
}`

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <button type="button" className="copy-btn" onClick={handleCopy}>
      {copied ? 'Copied!' : label}
    </button>
  )
}

function App() {
  const [content, setContent] = useState(DEMO_CONTENT)
  const [showHtml, setShowHtml] = useState(false)

  return (
    <div className="page">
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#top">
            <span className="brand-mark">RTE</span>
            <span className="brand-name">react-lite-rich-text-editor</span>
          </a>
          <nav className="nav-links">
            <a href="#demo">Demo</a>
            <a href="#features">Features</a>
            <a href="#install">Install</a>
            <a
              className="nav-cta"
              href="https://www.npmjs.com/package/react-lite-rich-text-editor"
              target="_blank"
              rel="noreferrer"
            >
              npm
            </a>
            <a
              className="nav-cta ghost"
              href="https://github.com/Elango-P/rich-text-editor"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-badge">Zero-dependency · React · MIT</div>
          <h1>
            A premium rich text editor
            <span className="hero-accent"> without the baggage</span>
          </h1>
          <p className="hero-lead">
            Lightweight WYSIWYG for React with tables, image resize, video embeds,
            markdown shortcuts, and clean HTML output — install once, ship faster.
          </p>

          <div className="hero-actions">
            <a className="btn primary" href="#demo">
              Try the live demo
            </a>
            <a
              className="btn secondary"
              href="https://www.npmjs.com/package/react-lite-rich-text-editor"
              target="_blank"
              rel="noreferrer"
            >
              View on npm
            </a>
          </div>

          <div className="install-bar" id="install">
            <code>{INSTALL_CMD}</code>
            <CopyButton text={INSTALL_CMD} />
          </div>

          <div className="stats">
            <div className="stat">
              <strong>0</strong>
              <span>runtime deps</span>
            </div>
            <div className="stat">
              <strong>1</strong>
              <span>component API</span>
            </div>
            <div className="stat">
              <strong>MIT</strong>
              <span>open source</span>
            </div>
          </div>
        </section>

        <section className="demo-section" id="demo">
          <div className="section-head">
            <h2>Live demo</h2>
            <p>Edit freely — formatting, tables, links, and media all work in the browser.</p>
          </div>

          <div className="demo-card">
            <RichTextEditor
              label="Playground"
              value={content}
              onChange={setContent}
              placeholder="Start writing…"
              showBorder={true}
              minHeight="420px"
            />

            <div className="demo-toolbar">
              <button
                type="button"
                className={`toggle-btn ${showHtml ? 'active' : ''}`}
                onClick={() => setShowHtml((v) => !v)}
              >
                {showHtml ? 'Hide HTML output' : 'Show HTML output'}
              </button>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setContent(DEMO_CONTENT)}
              >
                Reset demo content
              </button>
            </div>

            {showHtml && (
              <div className="html-panel">
                <div className="html-panel-head">
                  <span>HTML output</span>
                  <CopyButton text={content} label="Copy HTML" />
                </div>
                <pre className="html-display">{content}</pre>
              </div>
            )}
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-head">
            <h2>Why developers pick it</h2>
            <p>Everything you need for forms, CMS fields, and notes — nothing you do not.</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="usage-section">
          <div className="section-head">
            <h2>Drop it into your app</h2>
            <p>One import, controlled value, familiar React props.</p>
          </div>
          <div className="code-card">
            <div className="code-card-head">
              <span>App.jsx</span>
              <CopyButton text={USAGE_SNIPPET} label="Copy code" />
            </div>
            <pre className="code-block">{USAGE_SNIPPET}</pre>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ship a better editor today</h2>
          <p>
            Install from npm, star the repo if it helps, and open an issue if you need a feature.
          </p>
          <div className="hero-actions">
            <a
              className="btn primary"
              href="https://www.npmjs.com/package/react-lite-rich-text-editor"
              target="_blank"
              rel="noreferrer"
            >
              Install from npm
            </a>
            <a
              className="btn secondary"
              href="https://github.com/Elango-P/rich-text-editor"
              target="_blank"
              rel="noreferrer"
            >
              Star on GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          MIT License · Built by{' '}
          <a href="https://github.com/Elango-P" target="_blank" rel="noreferrer">
            Elango
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
