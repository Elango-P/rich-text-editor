import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaImage, FaBold, FaItalic, FaUnderline, FaTextHeight, FaAlignCenter, FaAlignRight, FaAlignJustify, FaAlignLeft, FaListOl, FaListUl, FaFont } from "./icons";
import { draftBlocksToHTML, isValidDraftFormat } from "./utils";
import Spinner from "./Spinner";
import LabelComponent from "./Label";
import "./RichTextEditor.css";

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
  editable: defaultEditable = false,
  value,
  isLoading,
  isList = false,
  label,
  showBorder = true,
  paddingLeft,
  minHeight,
  maxHeight,
  onImageUpload,
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
  const [editable, setEditable] = useState(defaultEditable);

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
      const align = img.getAttribute('data-align') || 'center';
      wrapper.className = `image-container image-align-${align}`;
      wrapper.style.cursor = editable ? 'pointer' : 'default';

      img.className = "rte-image";
      img.style.cssText = ""; // Reset inline styles
      img.setAttribute('data-align', align);
      img.dataset.hasDeleteButton = "true";

      // Add click listener to open modal
      img.addEventListener("click", () => openImageModal(img.src));

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "×";
      deleteBtn.className = "image-delete-button";
      deleteBtn.style.display = editable ? 'flex' : 'none';
      deleteBtn.style.pointerEvents = editable ? 'auto' : 'none';
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
          const uploadPromise = onImageUpload
            ? onImageUpload(file)
            : readFileAsDataURL(file);

          uploadPromise.then((url) => {
            if (url) {
              // if the user's onImageUpload resolves to `{ mediaUrl: '...' }` like the previous MediaUpload, handle it
              const finalUrl = typeof url === 'object' && url !== null && url.mediaUrl ? url.mediaUrl : url;
              insertImage(finalUrl, file.name || 'pasted-image');
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
        const uploadPromise = onImageUpload
          ? onImageUpload(file)
          : readFileAsDataURL(file);

        uploadPromise.then((url) => {
          if (url) {
            const finalUrl = typeof url === 'object' && url !== null && url.mediaUrl ? url.mediaUrl : url;
            insertImage(finalUrl, file.name);
          }
          setIsUploading(false);
        }).catch((error) => {
          console.error('Error processing image:', error);
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
      let range;

      if (!sel || sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
        editorRef.current.focus();
        
        // Move cursor to end if not already in editor
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        range = sel.getRangeAt(0);
      }

      range.deleteContents();
      range.insertNode(node);
      
      const space = document.createTextNode("\u00A0");
      if (node.parentNode) {
        node.parentNode.insertBefore(space, node.nextSibling);
      }
      
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.error("Insertion error:", error);
      if (editorRef.current) {
        editorRef.current.appendChild(node);
      }
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
    // Add protocol if missing
    let url = linkUrl.trim();
    if (url && !/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
      url = `https://${url}`;
    }

    const safeUrl = escapeAttr(url);
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
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const editor = editorRef.current;
    if (!editor) return;

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
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
    const blocksToStyle = new Set();
    const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'];

    const tempRange = range.cloneRange();

    while ((node = walker.nextNode())) {
      if (node.nodeType === 1 && blockTags.includes(node.tagName)) {
        blocksToStyle.add(node);
      } else if (node.nodeType === 3) {
        let parent = node.parentNode;
        while (parent && parent !== editor && !blockTags.includes(parent.tagName)) {
          parent = parent.parentNode;
        }
        if (parent && parent !== editor && blockTags.includes(parent.tagName)) {
          blocksToStyle.add(parent);
        }
      }
    }

    if (blocksToStyle.size > 0) {
      blocksToStyle.forEach(block => {
        block.style.lineHeight = value;
      });
    } else {
      let common = range.commonAncestorContainer;
      if (common.nodeType === 3) common = common.parentNode;

      while (common && common !== editor && !blockTags.includes(common.tagName)) {
        common = common.parentNode;
      }

      if (common && common !== editor) {
        common.style.lineHeight = value;
      } else if (editor) {
        document.execCommand('formatBlock', false, 'div');
        let newCommon = window.getSelection().getRangeAt(0).commonAncestorContainer;
        if (newCommon.nodeType === 3) newCommon = newCommon.parentNode;
        if (newCommon && newCommon !== editor) {
          newCommon.style.lineHeight = value;
        }
      }
    }

    try {
      sel.removeAllRanges();
      sel.addRange(tempRange);
    } catch (e) { }

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
      const uploadPromise = onImageUpload
        ? onImageUpload(file)
        : readFileAsDataURL(file);

      uploadPromise.then((url) => {
        if (url) {
          const finalUrl = typeof url === 'object' && url !== null && url.mediaUrl ? url.mediaUrl : url;
          insertImage(finalUrl, file.name);
        }
        setIsUploading(false);
        e.target.value = null;
      }).catch((error) => {
        console.error('Error uploading image:', error);
        setIsUploading(false);
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
      e.preventDefault();
      e.stopPropagation();
      window.open(clickedLink.href, '_blank');
      return;
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
    <div className="rte-main-wrapper" style={{ width: '100%' }}>
      {label && <LabelComponent>{label}</LabelComponent>}
      <div
        className={!showBorder ? "" : "rte-container"}
        onClick={handleEditorClick}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Toolbar */}
          <div className="rte-toolbar">
            {/* Bold */}
            <button
              type="button"
              title="Bold"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("bold");
                triggerChange();
                focus();
              }}
              className={`rte-toolbar-button ${isBold ? "active" : ""}`}
            >
              <FaBold size={14} />
            </button>

            {/* Italic */}
            <button
              type="button"
              title="Italic"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("italic");
                triggerChange();
                focus();
              }}
              className={`rte-toolbar-button ${isItalic ? "active" : ""}`}
            >
              <FaItalic size={14} />
            </button>

            {/* Underline */}
            <button
              type="button"
              title="Underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("underline");
                triggerChange();
                focus();
              }}
              className={`rte-toolbar-button ${isUnderline ? "active" : ""}`}
            >
              <FaUnderline size={14} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Font Size */}
            <select
              value={currentFontSize}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const size = e.target.value;
                if (!size) return;
                applyFontSize(size);
                setCurrentFontSize(size);
                focus();
              }}
              className="rte-toolbar-select"
              style={{ width: '70px' }}
            >
              {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48].map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>

            {/* Text Color */}
            <label title="Font Color" className="rte-color-picker-label">
              <FaFont size={14} style={{ color: fontColor }} />
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
                className="rte-color-input"
              />
            </label>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Alignment */}
            <button
              type="button"
              title="Align Left"
              className={`rte-toolbar-button ${activeAlign === "left" ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyLeft");
                setActiveAlign("left");
              }}
            >
              <FaAlignLeft size={14} />
            </button>

            <button
              type="button"
              title="Align Center"
              className={`rte-toolbar-button ${activeAlign === "center" ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyCenter");
                setActiveAlign("center");
              }}
            >
              <FaAlignCenter size={14} />
            </button>

            <button
              type="button"
              title="Align Right"
              className={`rte-toolbar-button ${activeAlign === "right" ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                exec("justifyRight");
                setActiveAlign("right");
              }}
            >
              <FaAlignRight size={14} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Lists */}
            <button
              type="button"
              title="Unordered List"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("unordered");
              }}
              className={`rte-toolbar-button ${currentListType === "unordered" ? "active" : ""}`}
            >
              <FaListUl size={14} />
            </button>
            <button
              type="button"
              title="Ordered List"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("ordered");
              }}
              className={`rte-toolbar-button ${currentListType === "ordered" ? "active" : ""}`}
            >
              <FaListOl size={14} />
            </button>

            {/* Line Height */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
                className="rte-toolbar-select"
                style={{ width: '64px', paddingLeft: '24px' }}
              >
                 <option value="" disabled>↕</option>
                {['1', '1.15', '1.5', '2'].map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', left: '6px', pointerEvents: 'none', color: '#9ca3af' }}>
                <FaTextHeight size={12} />
              </div>
            </div>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Actions */}
            <button
              type="button"
              title="Add Link"
              className="rte-toolbar-button"
              onMouseDown={(e) => {
                e.preventDefault();
                addLink();
              }}
            >
              <span style={{ fontSize: '16px' }}>🔗</span>
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
              className="rte-toolbar-button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (!isUploading) fileInputRef.current?.click();
              }}
              disabled={isUploading}
              title="Upload image"
            >
              {isUploading ? (
                <div className="rte-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
              ) : (
                <FaImage size={14} />
              )}
            </button>
          </div>
        {/* Editor Content Area */}
        <div
          ref={editorRef}
          contentEditable={editable && disabled !== true}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragStart={(e) => e.preventDefault()}
          onDragOver={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          style={{
            minHeight: minHeight || '150px',
            maxHeight: maxHeight || '500px',
            paddingLeft: paddingLeft || '12px'
          }}
          className="rte-content"
        />
        {linkModalOpen && (
          <div className="rte-modal-overlay" onClick={cancelLink}>
            <div className="rte-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="rte-modal-title">Insert Link</h3>
              <div className="rte-form-group">
                <label className="rte-label">URL</label>
                <input
                  type="url"
                  className="rte-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus
                  placeholder="https://example.com"
                />
              </div>
              <div className="rte-form-group">
                <label className="rte-label">Display Text</label>
                <input
                  type="text"
                  className="rte-input"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text"
                />
              </div>

              <div className="rte-modal-actions">
                <button type="button" className="rte-button rte-button-secondary" onClick={cancelLink}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rte-button rte-button-primary"
                  onClick={confirmLink}
                  disabled={!linkUrl}
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Zoom Modal */}
        {imageModalOpen && (
          <div className="rte-modal-overlay" onClick={closeImageModal}>
            <div
              style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageUrl}
                style={{
                  width: "100%",
                  maxHeight: "90vh",
                  borderRadius: '12px',
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.2s ease",
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}
                alt="Zoomed"
              />
            </div>
          </div>
        )}
      </div>

      {showEditButton && editable && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
          <button
            type="button"
            className="rte-button rte-button-secondary"
            onClick={() => setEditable(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rte-button rte-button-primary"
            onClick={() => {
              handleChange && handleChange(html);
              setEditable(false);
            }}
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
