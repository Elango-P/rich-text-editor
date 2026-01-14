import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaImage, FaArrowDown, FaBold, FaItalic, FaUnderline, FaTextHeight, FaAlignCenter, FaAlignRight, FaAlignJustify, FaAlignLeft, FaListOl, FaListUl, FaFonticons, FaFont, FaLink } from "react-icons/fa";
import { getRandomId } from "../lib/Helper";
import ObjectName from "../helpers/ObjectName";
import Media from "../helpers/Media";
import MediaUpload from "../helpers/MediaUpload";
import Spinner from "./Spinner";
import { draftBlocksToHTML, isValidDraftFormat } from "../lib/draftJsToHtml";
import LabelComponent from "./Label";

// Helper functions for HTML escaping
const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const escapeAttr = (str) => escapeHtml(str).replace(/"/g, "&quot;");

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export default function RichTextEditor({
  onChange,
  showEditButton,
  onBlur,
  disabled = false,
  value,
  isLoading,
  isList = false,
  label,
  showBorder = true,
  paddingLeft,
  minHeight,
  maxHeight,
}) {

  if (isLoading) {
    return <Spinner />;
  }

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollTopRef = useRef(0);

  const [html, setHtml] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const selectionRangeRef = useRef(null);
  const [editable, setEditable] = useState(false);

  // NEW: Track current list type for dropdown
  const [currentListType, setCurrentListType] = useState(null);

  // NEW: Track active styles for toolbar buttons
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // NEW: Track current font size
  const [currentFontSize, setCurrentFontSize] = useState("16");

  // NEW: Track current line height
  const [currentLineHeight, setCurrentLineHeight] = useState("");
  const [activeAlign, setActiveAlign] = useState(null);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const openImageModal = (url) => {
    if (editorRef.current) {
      scrollTopRef.current = editorRef.current.scrollTop;
    }
    setSelectedImageUrl(url);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImageUrl("");
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel((prevZoom) => prevZoom + 0.1);
  };

  const handleZoomOut = () => {
    setZoomLevel((prevZoom) => Math.max(0.1, prevZoom - 0.1));
  };

  // Effect to restore scroll position after modal closes
  useEffect(() => {
    if (!imageModalOpen && editorRef.current) {
      editorRef.current.scrollTop = scrollTopRef.current;
    }
  }, [imageModalOpen]);

  useEffect(() => {
    if (!imageModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeImageModal();
      }
    };

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [imageModalOpen]);

  useEffect(() => {
    const handleClick = (e) => {
      const deleteBtn = e.target.closest('button[title="Remove image"]');
      if (deleteBtn && editable) {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = deleteBtn.closest('.image-container');
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
          triggerChange();
        }
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleClick);
      return () => {
        editor.removeEventListener('click', handleClick);
      };
    }
  }, [editable]);

  useEffect(() => {
    if (editorRef.current && value) {
      requestAnimationFrame(() => processExistingImages(editorRef.current));
    }
  }, [value]);

  // Runs whenever editable changes (toggles delete icon visibility)
  useEffect(() => {
    processExistingImages(editorRef.current, editable);
  }, [html, editable]);
  useEffect(() => {
    // Only update if value is a string and different from current html
    if (value) {
      try {
        // Check if value is a Draft.js content state (either stringified or object)
        if (value && isValidDraftFormat(value)) {
          const htmlContent = draftBlocksToHTML(value);
          setHtml(htmlContent);
          if (editorRef.current) {
            editorRef.current.innerHTML = htmlContent;
          }
        } else if (typeof value === 'string') {
          // Unescape HTML entities before setting the content
          const unescapedValue = unescapeHtml(value);
          setHtml(unescapedValue);
          if (editorRef.current) {
            editorRef.current.innerHTML = unescapedValue || '';
          }
        }
      } catch (e) {
        console.error('Error processing editor content:', e);
        // Fallback to raw value if parsing fails
        const unescapedValue = typeof value === 'string' ? unescapeHtml(value) : value;
        setHtml(unescapedValue);
        if (editorRef.current) {
          editorRef.current.innerHTML = unescapedValue || '';
        }
      }
    } else {
      setHtml('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [!isList]);

  // Call onChange whenever html state updates
  useEffect(() => {
    onChange && onChange(html);
  }, [html, onChange]);
  // Trigger change manually
  const triggerChange = useCallback(() => {
    const next = getCleanHtml();
    setHtml(next);
  }, []);

  const handleChange = () => {
    if (!editorRef.current) return;

    // Clone editor content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorRef.current.innerHTML;

    // Remove delete buttons from the clone
    tempDiv.querySelectorAll('button[title="Remove image"]').forEach(btn => btn.remove());

    // Send cleaned HTML to onBlur
    onBlur && onBlur(tempDiv.innerHTML);
  };

  // Detect if selection is inside a list (ol or ul)
  const detectListType = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setCurrentListType(null);
      return;
    }
    let node = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === "OL") {
        setCurrentListType("ordered");
        return;
      }
      if (node.nodeName === "UL") {
        setCurrentListType("unordered");
        return;
      }
      node = node.parentNode;
    }
    setCurrentListType(null);
  };

  // Helper to walk up DOM to find style tags or CSS style:
  const isParentStyle = (node, ...tagNames) => {
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && tagNames.includes(node.tagName)) return true;

      // Also check inline style for bold and italic:
      if (node.nodeType === 1 && node.style) {
        const style = node.style;
        if (
          tagNames.includes("bold") &&
          (style.fontWeight === "bold" || Number(style.fontWeight) >= 600)
        )
          return true;
        if (tagNames.includes("italic") && style.fontStyle === "italic")
          return true;
        if (
          tagNames.includes("underline") &&
          style.textDecoration.includes("underline")
        )
          return true;

        if (node.style && node.style.color) {
          return node.style.color;
        }

        // 2️⃣ Check for <font color=""> (older HTML)
        if (node.tagName === "FONT" && node.getAttribute("color")) {
          return node.getAttribute("color");
        }
      }
      node = node.parentNode;
    }
    return false;
  };

  // Update style states based on selection or cursor position
  const updateStyleStates = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setFontColor("#000000"); // default
      return;
    }
    const container =
      sel.anchorNode.nodeType === 3
        ? sel.anchorNode.parentNode
        : sel.anchorNode;

    const computedAlign = window.getComputedStyle(container).textAlign;
    setActiveAlign(computedAlign);
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      // Cursor only, check parent nodes
      const container =
        sel.anchorNode.nodeType === 3
          ? sel.anchorNode.parentNode
          : sel.anchorNode;
      const computedStyles = window.getComputedStyle(container);
      setIsBold(isParentStyle(container, "B", "STRONG", "bold"));
      setIsItalic(isParentStyle(container, "I", "EM", "italic"));
      setIsUnderline(isParentStyle(container, "U", "underline"));

      // ✅ Get computed color from container
      const computedColor = window.getComputedStyle(container).color;
      setFontColor(rgbToHex(computedColor));

    } else {
      // Text selected, use execCommand state
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
      setIsUnderline(document.queryCommandState("underline"));

      // ✅ For selection, get color from selection's start container
      const container =
        sel.anchorNode.nodeType === 3
          ? sel.anchorNode.parentNode
          : sel.anchorNode;

      const computedColor = window.getComputedStyle(container).color;
      setFontColor(rgbToHex(computedColor));
    }
  };

  // Helper to convert rgb() to hex
  function rgbToHex(rgb) {
    const result = rgb.match(/\d+/g);
    if (!result) return "#000000";
    return (
      "#" +
      result
        .slice(0, 3)
        .map((x) => {
          const hex = parseInt(x, 10).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }


  // Listen for selection changes globally to update styles and list type
  useEffect(() => {
    document.addEventListener("selectionchange", detectListType);
    document.addEventListener("selectionchange", updateStyleStates);

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const element = range.startContainer.parentElement.closest('[style*="font-size"]');

      if (element) {
        const fontSize = window.getComputedStyle(element).fontSize;
        const sizeValue = fontSize ? parseInt(fontSize) : 16;
        setCurrentFontSize(sizeValue.toString());
      } else {
        setCurrentFontSize("16"); // Default size
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", detectListType);
      document.removeEventListener("selectionchange", updateStyleStates);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const focus = () => editorRef.current && editorRef.current.focus();

  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    triggerChange();
    focus();
  };

  const [fontColor, setFontColor] = useState("#000000");

  const handleColorChange = (color) => {
    setFontColor(color);
    exec("foreColor", color);
  };

  const addLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    selectionRangeRef.current = sel.getRangeAt(0).cloneRange();

    const selectedText = sel.toString();

    if (selectedText.length > 0) {
      setLinkText(selectedText);
      setLinkUrl("");
      setLinkModalOpen(true);
    } else {
      setLinkText("");
      setLinkUrl("");
      setLinkModalOpen(true);
    }
  };


  const onFileInput = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    readFileAsDataURL(file).then((dataUrl) => {
      insertImage(dataUrl, file.name);
    });
    e.target.value = null;
  };

  const processExistingImages = (container) => {
    if (!container) return;

    container.querySelectorAll("img").forEach((img) => {
      // REMOVE the old wrapper if it exists so we can re-add
      const oldWrapper = img.closest(".image-container");
      if (oldWrapper) {
        oldWrapper.replaceWith(img); // unwrap
      }

      const wrapper = document.createElement("div");
      wrapper.className = "image-container";

      // Get alignment from data-align attribute or default to center
      const align = img.getAttribute('data-align') || 'center';
      wrapper.className += ` image-align-${align}`;

      wrapper.style.cssText = `
        position: relative;
        display: inline-block;
        margin: 15px;
        vertical-align: top;
        background: whitesmoke;
        border-radius: 6px;
        box-sizing: border-box;
        max-width: 280px;
        min-width: 280px;
        min-height: 250px;
        max-height: 250px;
        ${align === 'left' ? 'float: left; margin-right: 15px;' : ''}
        ${align === 'right' ? 'float: right; margin-left: 15px;' : ''}
        ${align === 'center' ? 'clear: both;' : ''}
        transition: opacity 0.2s, border 0.2s;
        ${editable ? 'cursor: pointer;' : ''}
      `;

      img.style.cssText = `
         max-width: 280px;
        min-width: 280px;
        min-height: 250px;
        max-height: 250px;
        height: 250px;
        display: block;
        object-fit: contain;
        /* pointer-events: none; */
      `;
      img.setAttribute('data-align', align);
      img.dataset.hasDeleteButton = "true";

      // Add click listener to open modal
      img.addEventListener("click", () => openImageModal(img.src));

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "×";
      deleteBtn.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        transform: translate(50%, -50%);
        background: red;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: ${editable ? 'flex' : 'none'};
        align-items: center;
        justify-content: center;
         cursor: ${editable ? 'pointer' : 'default'};
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        padding: 0;
        font-size: 16px;
        line-height: 1;
        font-weight: bold;
        z-index: 10;
        pointer-events: ${editable ? 'auto' : 'none'};
      `;
      deleteBtn.title = "Remove image";

      deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const wrapper = e.currentTarget.closest(".image-container");
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
          triggerChange && triggerChange();
        }
      };

      const { parentNode, nextSibling } = img;
      if (parentNode) {
        parentNode.removeChild(img);
        wrapper.appendChild(img);
        wrapper.appendChild(deleteBtn);

        if (nextSibling) {
          parentNode.insertBefore(wrapper, nextSibling);
        } else {
          parentNode.appendChild(wrapper);
        }
      }
    });
  };

  useEffect(() => {
    if (editorRef.current && value) {
      requestAnimationFrame(() => processExistingImages(editorRef.current));
    }
  }, [value]);

  const insertImage = async (dataUrl, fileName) => {
    try {
      if (editable) {

        // Create container for the image
        const container = document.createElement('div');
        container.className = 'image-container';

        // Create image element
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = fileName || "image";
        img.addEventListener("click", () => openImageModal(dataUrl));

        // Add elements to container
        container.appendChild(img);

        // Insert at cursor position
        insertNodeAtCursor(container);
        triggerChange();

        // Immediately process newly inserted image so delete button appears
        requestAnimationFrame(() => {
          processExistingImages(editorRef.current);
        });
      }
    } catch (err) {
      console.error('Error inserting image:', err);
    }
  };

  const readFileAsDataURL = (file) =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = (ev) => res(ev.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  // NEW: Function to auto-convert URLs to links
  const autoConvertUrlsToLinks = (html) => {
    return html.replace(URL_REGEX, (url) => {
      const safeUrl = escapeAttr(url);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: blue;">${url}</a>`;
    });
  };

  const handlePaste = useCallback((e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // Check for image in clipboard
    const items = clipboardData.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setIsUploading(true);
          const objectId = getRandomId();
          const mediaParams = {
            selectedFile: file,
            objectId,
            ObjectName: ObjectName.COMMENT,
            visiblity: Media.VISIBILITY_PUBLIC,
          };

          MediaUpload.uploadFile(mediaParams, (res) => {
            if (res?.mediaUrl) {
              insertImage(res.mediaUrl, file.name || 'pasted-image');
            }
            setIsUploading(false);
          }).catch((error) => {
            console.error('Error uploading pasted image:', error);
            setIsUploading(false);
          });
        }
        return;
      }
    }

    const htmlData = clipboardData.getData('text/html');
    if (htmlData && htmlData.trim()) {
      e.preventDefault();

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlData;

      tempDiv.querySelectorAll('script, meta, link').forEach(el => el.remove());

      document.execCommand('styleWithCSS', false, true);
      document.execCommand('insertHTML', false, tempDiv.innerHTML);
      document.execCommand('styleWithCSS', false, false);

      triggerChange();
      focus();
      return;
    }

    const plainText = clipboardData.getData('text/plain');
    if (plainText) {
      e.preventDefault();

      let htmlToInsert = escapeHtml(plainText);

      htmlToInsert = htmlToInsert.replace(URL_REGEX, (url) => {
        const safeUrl = escapeAttr(url.trim());
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: blue; text-decoration: underline;">${escapeHtml(url)}</a>`;
      });

      htmlToInsert = htmlToInsert.replace(/\n/g, '<br>');

      document.execCommand('insertHTML', false, htmlToInsert);
      triggerChange();
      focus();
    }
  }, [insertImage, triggerChange]);

  const handleDrop = async (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));

    for (const file of imageFiles) {
      try {
        setIsUploading(true);
        const objectId = getRandomId();
        const mediaParams = {
          selectedFile: file,
          objectId,
          ObjectName: ObjectName.COMMENT,
          visiblity: Media.VISIBILITY_PUBLIC,
        };

        MediaUpload.uploadFile(mediaParams, (res) => {
          if (res?.mediaUrl) {
            insertImage(res.mediaUrl, file.name);
          }
          setIsUploading(false);
        });
      } catch (error) {
        console.error('Error processing image:', error);
        setIsUploading(false);
      }
    }
  };

  const insertNodeAtCursor = (node) => {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        editorRef.current && editorRef.current.appendChild(node);
        return;
      }
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      const space = document.createTextNode(" ");
      node.parentNode && node.parentNode.insertBefore(space, node.nextSibling);
      range.setStartAfter(space);
      range.collapse(true);

      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.log(error)
    }
  };

  const getCleanHtml = () => {
    if (!editorRef.current) return "";
    return editorRef.current.innerHTML;
  };

  // Helper function to unescape HTML entities
  const unescapeHtml = (html) => {
    if (!html) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const handleKeyDown = useCallback((e) => {
    // Handle Enter key
    if (e.key === 'Enter') {
      e.preventDefault();

      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      const parent = node.nodeType === 3 ? node.parentNode : node;

      // Check if we're in a list item
      const listItem = parent.closest('li');
      if (listItem) {
        const list = listItem.parentNode;
        const isOrderedList = list.tagName === 'OL';

        // Create a new list item
        const newItem = document.createElement('li');

        // If we're at the end of a list item, add a new one
        if (range.collapsed && range.endOffset === node.length) {
          // If it's empty, create a regular paragraph instead
          if (listItem.textContent.trim() === '') {
            document.execCommand('insertHTML', false, '<div><br></div>');
            // Move the cursor to the new line
            const newRange = document.createRange();
            const newDiv = editorRef.current.lastElementChild;
            newRange.setStart(newDiv, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return;
          }

          // Insert new list item
          if (listItem.nextSibling) {
            list.insertBefore(newItem, listItem.nextSibling);
          } else {
            list.appendChild(newItem);
          }

          // Move cursor to the new list item
          const newRange = document.createRange();
          newRange.setStart(newItem, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // If we're in the middle of text, split the list item
          const textBefore = node.textContent.substring(0, range.startOffset);
          const textAfter = node.textContent.substring(range.startOffset);

          // Update current item
          node.textContent = textBefore;

          // Insert new item after current one
          newItem.textContent = textAfter;

          if (listItem.nextSibling) {
            list.insertBefore(newItem, listItem.nextSibling);
          } else {
            list.appendChild(newItem);
          }

          // Move cursor to the new list item
          const newRange = document.createRange();
          newRange.setStart(newItem.firstChild || newItem, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else {
        // Regular text, insert a new paragraph
        document.execCommand('insertHTML', false, '<div><br></div>');
      }

      triggerChange();
      return;
    }

    // Handle Ctrl/Cmd + B/I/U for bold/italic/underline
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      exec("bold");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      exec("italic");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "u") {
      e.preventDefault();
      exec("underline");
    }
  }, [exec, triggerChange]);

  const confirmLink = () => {
    if (!linkUrl) {
      setLinkModalOpen(false);
      return;
    }
    const safeUrl = escapeAttr(linkUrl);
    const safeText = escapeHtml(linkText || linkUrl);

    const sel = window.getSelection();
    sel.removeAllRanges();
    if (selectionRangeRef.current) {
      sel.addRange(selectionRangeRef.current);
    }

    const linkHtml = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: blue;">${safeText}</a>`;
    document.execCommand("insertHTML", false, linkHtml);

    setLinkModalOpen(false);
    triggerChange();
    focus();
    selectionRangeRef.current = null;
  };

  const cancelLink = () => {
    setLinkModalOpen(false);
    selectionRangeRef.current = null;
  };

  const handleSelect = (type) => {
    exec(type === "unordered" ? "insertUnorderedList" : "insertOrderedList");
  };

  const onLineHeightChange = (value) => {
    if (!value) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    // Save the current selection
    const range = sel.getRangeAt(0);

    // Check if selection spans multiple elements (like in select all)
    const isMultiElementSelection = !range.collapsed &&
      (range.toString().length > 0 || range.startContainer !== range.endContainer);

    if (isMultiElementSelection) {
      // For multi-element selection, wrap in a div with the line height
      const span = document.createElement('div');
      span.style.lineHeight = value;

      try {
        // Extract the selected content
        const fragment = range.extractContents();

        // Apply line height to all block elements in the selection
        const blocks = fragment.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, li');
        if (blocks.length > 0) {
          blocks.forEach(block => {
            block.style.lineHeight = value;
          });
          // Insert the modified content back
          range.deleteContents();
          range.insertNode(fragment);
        } else {
          // If no block elements, wrap in a div with line height
          span.appendChild(fragment);
          range.insertNode(span);
        }
      } catch (e) {
        console.error("Error applying line height:", e);
      }
    } else {
      // For single element or cursor position, use execCommand
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('lineHeight', false, value);
    }

    setCurrentLineHeight(value);
    triggerChange();
    focus();
  };

  const applyFontSize = (size) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const sizePx = `${size}px`;

    // Collapsed selection (cursor only): insert a styled zero-width span
    if (range.collapsed) {
      const span = document.createElement("span");
      span.style.fontSize = sizePx;
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);

      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      triggerChange();
      focus();
      return;
    }

    // Extended selection (highlighted text)
    try {
      const editor = editorRef.current;
      if (!editor) return;

      // We will iterate through all the text nodes in the selection
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            return range.intersectsNode(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
        },
        false
      );

      let node;
      const nodesToStyle = [];
      while ((node = walker.nextNode())) {
        nodesToStyle.push(node);
      }

      const savedRange = range.cloneRange();
      let lastInsertedNode = null;

      // Iterate through the selected text nodes and wrap them in spans
      for (const textNode of nodesToStyle) {
        const parent = textNode.parentNode;

        // This is important: check if the parent is a block-level element
        // like a list item or paragraph. If so, we want to style the block
        // itself to avoid breaking its structure.
        const isBlockLevel = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'].includes(parent.tagName);

        if (isBlockLevel) {
          parent.style.fontSize = sizePx;
        } else {
          // For inline text, wrap the selected portion in a new span
          const startOffset = textNode === savedRange.startContainer ? savedRange.startOffset : 0;
          const endOffset = textNode === savedRange.endContainer ? savedRange.endOffset : textNode.length;

          const newSpan = document.createElement("span");
          newSpan.style.fontSize = sizePx;
          newSpan.textContent = textNode.textContent.substring(startOffset, endOffset);

          const tempRange = document.createRange();
          tempRange.setStart(textNode, startOffset);
          tempRange.setEnd(textNode, endOffset);

          tempRange.deleteContents();
          tempRange.insertNode(newSpan);
          lastInsertedNode = newSpan;
        }
      }

      // After styling, we need to correctly position the cursor
      if (lastInsertedNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastInsertedNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        // If no nodes were wrapped (e.g., we styled a block), restore the original selection
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }

    } catch (err) {
      console.error("Error applying font size:", err);
    }

    triggerChange();
    focus();
  };
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      const html = editorRef.current.innerHTML;
      setHtml(html);
      onChange(html);
    }
  }, [onChange]);
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const objectId = getRandomId();
      const mediaParams = {
        selectedFile: file,
        objectId,
        ObjectName: ObjectName.COMMENT,
        visiblity: Media.VISIBILITY_PUBLIC,
      };

      MediaUpload.uploadFile(mediaParams, (res) => {
        if (res?.mediaUrl) {
          insertImage(res.mediaUrl, file.name);
        }
        setIsUploading(false);
        e.target.value = null;
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      setIsUploading(false);
    }
  };
  useEffect(() => {
    // If disabled is explicitly false, make sure the editor is not editable
    if (disabled === true) {
      setEditable(false);
    }
  }, [disabled]);

  const handleEditorClick = useCallback((e) => {
    // Check if the click is on a link
    const clickedLink = e.target.closest('a');

    if (clickedLink) {
      // Ensure the link opens in a new tab
      clickedLink.target = '_blank';
      clickedLink.rel = 'noopener noreferrer';
      return; // Let the default link behavior happen
    }

    // If disabled is true, prevent editing
    if (disabled === true) {
      e.preventDefault();
      return;
    }

    // Only allow setting editable to true if not disabled
    if (!editable && disabled !== true) {
      setEditable(true);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 0);
    }
  }, [editable, disabled]);

  return (
    <div>
      <LabelComponent>{label ? label : ""}</LabelComponent>
      <div
        className={!showBorder ? "" : "border rounded bg-white p-3"}
        onClick={handleEditorClick}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Toolbar */}
        {editable &&
          <div className={!showBorder ? "" : "flex flex-wrap gap-2 mb-3 items-center border p-2 "} >
            {/* Bold */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("bold");
                triggerChange();
                focus();
              }}
              className={`h-8 w-8 flex items-center justify-center rounded ${isBold ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
            >
              <FaBold />
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("italic");
                triggerChange();
                focus();
              }}
              className={`h-8 w-8 flex items-center justify-center rounded ${isItalic ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
            >
              <FaItalic />
            </button>

            {/* Underline */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("underline");
                triggerChange();
                focus();
              }}
              className={`h-8 w-8 flex items-center justify-center rounded ${isUnderline ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
            >
              <FaUnderline />
            </button>

            {/* Font Size */}
            <div className="flex items-center gap-2">
              <select
                value={currentFontSize}
                onMouseDown={(e) => {
                  e.stopPropagation(); // Prevent editor blur
                }}
                onChange={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const size = e.target.value;
                  if (!size) return;
                  applyFontSize(size);
                  setCurrentFontSize(size);
                  focus(); // Return focus to editor
                }}
                className="h-8 w-20 rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500"
              >
                {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 37, 38, 40, 42, 45, 48].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </div>

            {/* Text Color */}
            <label
              title="Font Color"
              className="relative h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer"
            >
              <FaFont style={{ color: fontColor }} />
              <input
                type="color"
                value={fontColor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  handleColorChange(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            {/* Alignment */}
            <button
              type="button"
              className={`h-8 w-8 flex items-center justify-center rounded border ${activeAlign === "left"
                ? "bg-blue-200 border-blue-500"
                : "bg-gray-100 border-gray-300"
                } hover:bg-blue-100 hover:border-blue-500`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyLeft");
                setActiveAlign("left");
              }}
            >
              <FaAlignLeft className="ml-1" />
            </button>

            <button
              type="button"
              className={`h-8 w-8 flex items-center justify-center rounded border ${activeAlign === "center"
                ? "bg-blue-200 border-blue-500"
                : "bg-gray-100 border-gray-300"
                } hover:bg-blue-100 hover:border-blue-500`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyCenter");
                setActiveAlign("center");
              }}
            >
              <FaAlignCenter className="ml-1" />
            </button>

            <button
              type="button"
              className={`h-8 w-8 flex items-center justify-center rounded border ${activeAlign === "right"
                ? "bg-blue-200 border-blue-500"
                : "bg-gray-100 border-gray-300"
                } hover:bg-blue-100 hover:border-blue-500`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyRight");
                setActiveAlign("right");
              }}
            >
              <FaAlignRight className="ml-1" />
            </button>

            <button
              type="button"
              className={`h-8 w-8 flex items-center justify-center rounded border ${activeAlign === "justify"
                ? "bg-blue-200 border-blue-500"
                : "bg-gray-100 border-gray-300"
                } hover:bg-blue-100 hover:border-blue-500`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyFull");
                setActiveAlign("justify");
              }}
            >
              <FaAlignJustify className="ml-1" />
            </button>

            <button
              type="button"
              style={{
                backgroundColor:
                  currentListType === "unordered" ? "#dbeafe" : undefined,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("unordered");
              }}
              className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FaListOl className="ml-1" />
            </button>
            <button
              type="button"
              style={{
                backgroundColor:
                  currentListType === "ordered" ? "#dbeafe" : undefined,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("ordered");
              }}
              className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FaListUl className="ml-1" />
            </button>
            {/* Line Height */}
            <div className="relative flex items-center ml-2">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <FaTextHeight className="text-gray-500" />
              </div>
              <select
                value={currentLineHeight}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.preventDefault();
                  const height = e.target.value;
                  if (height) {
                    onLineHeightChange(height);
                    setCurrentLineHeight(height);
                  }
                  focus();
                }}
                className="h-8 w-20 pl-8 rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500 appearance-none"
              >
                {['1', '1.15', '1.5', '2', '2.5', '3'].map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>



            <button
              type="button"
              className="h-8 px-4 w-12 flex items-center justify-center rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onMouseDown={(e) => {
                e.preventDefault();
                addLink();
              }}
            >
              Link
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 bg-gray-100 hover:bg-blue-100 hover:border-blue-500"
              onMouseDown={(e) => {
                e.preventDefault();
                if (!isUploading) fileInputRef.current?.click();
              }}
              disabled={isUploading}
              title="Upload image"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaImage size={20} color="black" />
              )}
            </button>
          </div>
        }
        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable={editable && disabled !== true}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          style={{
            minHeight: minHeight ? minHeight : 10,
            paddingLeft: paddingLeft ? paddingLeft : 10,
            border: !showBorder ? "" : editable ? "1px solid #e5e7eb" : "",
            borderRadius: 6,
            outline: "none",
            counterReset: "list-counter",
            overflowY: "auto",
            maxHeight: maxHeight ? maxHeight : "500px"
          }}
          className="scrollbar-hide"
        />



        {/* Link Modal */}
        {linkModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.3)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
            onClick={cancelLink}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                padding: 20,
                borderRadius: 8,
                minWidth: "25%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <label>
                URL:
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus
                  style={{ width: "100%" }}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Text:
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  style={{ width: "100%" }}
                  placeholder="Link text"
                />
              </label>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  type="button" className="bg-red-600 hover:bg-red-600 px-4 py-1 rounded text-white" onClick={cancelLink}>Cancel</button>
                <button
                  type="button" className="bg-green-600 hover:bg-green-600 px-4 py-1 text-white rounded" onClick={confirmLink} disabled={!linkUrl}>
                  Insert
                </button>
              </div>
            </div>
          </div>
        )}
        {imageModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 10000,
            }}
            onClick={closeImageModal}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90%",
                maxHeight: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageUrl}
                objectFit="contain"
                style={{
                  width: "100%",
                  maxHeight: "90vh",
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.2s ease-in-out",
                }}
                alt="Zoomed"
              />
            </div>
          </div>
        )}
      </div>
      {showEditButton && editable && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          <i
            className="fas fa-check me-2"
            onClick={() => {
              handleChange && handleChange(html);
              setEditable(false);
            }}
          ></i>
          <i
            className="fas fa-times"
            onClick={() => {
              setEditable(false);
            }}
          ></i>
        </div>
      )}
    </div>
  );

}