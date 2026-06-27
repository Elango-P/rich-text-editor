import { useState } from 'react'
import { RichTextEditor } from 'react-lite-rich-text-editor'
import './App.css'

function App() {
  const [content, setContent] = useState('<h1>Hello World</h1><p>Start editing...</p>')

  return (
    <div className="App">
      <div className="container">
        <h1>Rich Text Editor Example</h1>
        <p className="subtitle">Dependency-Free Industry Standard Editor</p>
        
        <div className="editor-wrapper">
          <RichTextEditor 
            label="Example Editor"
            value={content}
            onChange={setContent}
            placeholder="Tell us your story..."
            showBorder={true}
            minHeight="400px"
          />
        </div>

        <div className="preview">
          <h3>HTML Output Preview</h3>
          <div className="html-display">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
