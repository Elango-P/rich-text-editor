import * as React from 'react';

export interface RichTextEditorProps {
  /**
   * Callback fired when the editor content changes.
   * @param value The new HTML content of the editor.
   */
  onChange?: (value: string) => void;

  /**
   * Whether to show the edit/save/cancel buttons.
   */
  showEditButton?: boolean;

  /**
   * Callback fired when the editor loses focus.
   */
  onBlur?: (event: React.FocusEvent<HTMLDivElement>) => void;

  /**
   * Whether the editor is disabled.
   */
  disabled?: boolean;

  /**
   * Whether the editor is in editable mode.
   */
  editable?: boolean;

  /**
   * Initial or controlled HTML value of the editor.
   */
  value?: string;

  /**
   * Whether the editor is in a loading state (shows a spinner).
   */
  isLoading?: boolean;

  /**
   * Whether to treat the content as a list.
   */
  isList?: boolean;

  /**
   * Label for the editor field.
   */
  label?: string;

  /**
   * Whether to show the border around the editor.
   */
  showBorder?: boolean;

  /**
   * Left padding for the editor content.
   */
  paddingLeft?: number | string;

  /**
   * Minimum height of the editor.
   */
  minHeight?: number | string;

  /**
   * Maximum height of the editor.
   */
  maxHeight?: number | string;

  /**
   * Callback for image uploads. Should return a Promise that resolves to the image URL.
   * @param file The image file to upload.
   */
  onImageUpload?: (file: File) => Promise<string>;
}

/**
 * A lightweight React rich text editor.
 */
export const RichTextEditor: React.FC<RichTextEditorProps>;
