import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaImage, FaBold, FaItalic, FaUnderline, FaTextHeight, FaAlignCenter, FaAlignRight, FaAlignJustify, FaAlignLeft, FaListOl, FaListUl, FaFont, FaTable, FaYoutube, FaVideo, FaTrash, FaObjectGroup } from "./icons";
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
  editable: initialEditable = false,
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
  const [editable, setEditable] = useState(initialEditable);
  const lastSynchronizedHtmlRef = useRef("");

  useEffect(() => {
    setEditable(initialEditable);
  }, [initialEditable]);


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

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [hoveredTable, setHoveredTable] = useState(null);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const [selectedImage, setSelectedImage] = useState(null);
  const [metrics, setMetrics] = useState({ words: 0, chars: 0 });

  const updateMetrics = useCallback(() => {
    if (!editorRef.current) return;
    // Calculate metrics immediately but outside of render path
    const text = editorRef.current.innerText || "";
    const cleanText = text.replace(/[\n\r]/g, ' ').trim();
    const words = cleanText ? cleanText.split(/\s+/).length : 0;
    const chars = text.length;
    setMetrics({ words, chars });
  }, []);

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

  const saveSelection = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const handleKeyUp = () => {
    saveSelection();
    setSelectionVersion(v => v + 1);
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
      // Trigger selection update for toolbar reactivity
      setSelectionVersion(v => v + 1);

      const deleteBtn = e.target.closest('button[title="Remove image"]');
      if (deleteBtn && editable) {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = deleteBtn.closest('.image-container');
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
          triggerChange && triggerChange();
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
    // Removed dependency on editable to minimize listener churn
  }, []);


  useEffect(() => {
    if (editorRef.current && value && value !== lastSynchronizedHtmlRef.current) {
      requestAnimationFrame(() => processExistingImages(editorRef.current));
    }
  }, [value]);


  // Runs whenever editable changes (toggles delete icon visibility)
  useEffect(() => {
    processExistingImages(editorRef.current, editable);
  }, [editable]);

  useEffect(() => {
    // Only update if value is different from our last known synced state
    if (value && value !== lastSynchronizedHtmlRef.current) {
      try {
        let newContent = "";
        
        // Check if value is a Draft.js content state
        if (isValidDraftFormat(value)) {
          newContent = draftBlocksToHTML(value);
        } else if (typeof value === 'string') {
          // If value is already what we have in HTML state, skip unescaping
          if (value === html) {
             lastSynchronizedHtmlRef.current = value;
             return;
          }
          newContent = unescapeHtml(value);
        }

        if (newContent && newContent !== html) {
          lastSynchronizedHtmlRef.current = value;
          setHtml(newContent);
          if (editorRef.current && editorRef.current.innerHTML !== newContent) {
            editorRef.current.innerHTML = newContent;
          }
          updateMetrics();
        }
      } catch (e) {
        console.error('Error processing editor content:', e);
      }
    } else if (!value && html) {
      setHtml('');
      lastSynchronizedHtmlRef.current = "";
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        updateMetrics();
      }
    }
  }, [value, initialEditable, updateMetrics]);


  // Trigger change manually
  const triggerChange = useCallback(() => {
    const next = getCleanHtml();
    setHtml(next);
    lastSynchronizedHtmlRef.current = next;
    onChange && onChange(next);
  }, [onChange]);

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


  // Listen for selection changes globally to update styles and list type in one pass
  useEffect(() => {
    const handleGlobalSelectionSync = () => {
      // Only sync if the editor has focus
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !editorRef.current?.contains(sel.anchorNode)) {
        return;
      }

      // 1. Detect List Type
      let node = sel.anchorNode;
      let listFound = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "OL") { listFound = "ordered"; break; }
        if (node.nodeName === "UL") { listFound = "unordered"; break; }
        node = node.parentNode;
      }
      setCurrentListType(listFound);

      // 2. Update Style States
      const container = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
      const computedAlign = window.getComputedStyle(container).textAlign;
      setActiveAlign(computedAlign);
      
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        setIsBold(isParentStyle(container, "B", "STRONG", "bold"));
        setIsItalic(isParentStyle(container, "I", "EM", "italic"));
        setIsUnderline(isParentStyle(container, "U", "underline"));
        const computedColor = window.getComputedStyle(container).color;
        setFontColor(rgbToHex(computedColor));
      } else {
        setIsBold(document.queryCommandState("bold"));
        setIsItalic(document.queryCommandState("italic"));
        setIsUnderline(document.queryCommandState("underline"));
        const computedColor = window.getComputedStyle(container).color;
        setFontColor(rgbToHex(computedColor));
      }

      // 3. Current Font Size
      const element = range.startContainer.parentElement.closest('[style*="font-size"]');
      if (element) {
        const fontSize = window.getComputedStyle(element).fontSize;
        const sizeValue = fontSize ? parseInt(fontSize) : 16;
        setCurrentFontSize(sizeValue.toString());
      } else {
        setCurrentFontSize("16");
      }
    };

    document.addEventListener("selectionchange", handleGlobalSelectionSync);
    return () => {
      document.removeEventListener("selectionchange", handleGlobalSelectionSync);
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

  const findParentTag = (node, tagName) => {
    if (!node) return null;
    let curr = node;
    while (curr && curr !== editorRef.current) {
      if (curr.tagName === tagName) return curr;
      curr = curr.parentNode;
    }
    return null;
  };

  const tableAction = (action) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    
    const cell = findParentTag(sel.anchorNode, 'TD') || findParentTag(sel.anchorNode, 'TH');
    if (!cell) return;
    
    const row = cell.parentNode;
    const table = row.parentNode.closest('table');
    
    switch (action) {
      case 'addRowAbove':
        const newRowAbove = table.insertRow(row.rowIndex);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRowAbove.insertCell(i);
          newCell.style.border = "1px solid #e5e7eb";
          newCell.style.padding = "12px";
          newCell.innerHTML = "&nbsp;";
        }
        break;
      case 'addRowBelow':
        const newRowBelow = table.insertRow(row.rowIndex + 1);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRowBelow.insertCell(i);
          newCell.style.border = "1px solid #e5e7eb";
          newCell.style.padding = "12px";
          newCell.innerHTML = "&nbsp;";
        }
        break;
      case 'addColBefore':
        const cellIndex = cell.cellIndex;
        for (let i = 0; i < table.rows.length; i++) {
          const newCell = table.rows[i].insertCell(cellIndex);
          newCell.style.border = "1px solid #e5e7eb";
          newCell.style.padding = "12px";
          newCell.innerHTML = "&nbsp;";
        }
        break;
      case 'addColAfter':
        const cellIndexAfter = cell.cellIndex + 1;
        for (let i = 0; i < table.rows.length; i++) {
          const newCell = table.rows[i].insertCell(cellIndexAfter);
          newCell.style.border = "1px solid #e5e7eb";
          newCell.style.padding = "12px";
          newCell.innerHTML = "&nbsp;";
        }
        break;
      case 'deleteRow': {
        const rowIndex = row.rowIndex;
        const cellIndex = cell.cellIndex;
        table.deleteRow(rowIndex);
        if (table.rows.length === 0) {
          table.remove();
        } else {
          const targetRowIndex = Math.min(rowIndex, table.rows.length - 1);
          const targetRow = table.rows[targetRowIndex];
          const targetCell = targetRow.cells[Math.min(cellIndex, targetRow.cells.length - 1)];
          if (targetCell) {
            const range = document.createRange();
            range.selectNodeContents(targetCell);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            setSelectionVersion(v => v + 1);
          }
        }
        break;
      }
      case 'deleteCol': {
        const idx = cell.cellIndex;
        const rowIndex = row.rowIndex;
        for (let i = 0; i < table.rows.length; i++) {
          table.rows[i].deleteCell(idx);
        }
        if (table.rows[0].cells.length === 0) {
          table.remove();
        } else {
          const targetColIndex = Math.min(idx, table.rows[0].cells.length - 1);
          const targetCell = table.rows[rowIndex]?.cells[targetColIndex] || table.rows[0].cells[targetColIndex];
          if (targetCell) {
            const range = document.createRange();
            range.selectNodeContents(targetCell);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            setSelectionVersion(v => v + 1);
          }
        }
        break;
      }
      case 'mergeRight':
        if (cell.nextElementSibling) {
          const nextCell = cell.nextElementSibling;
          cell.colSpan = (cell.colSpan || 1) + (nextCell.colSpan || 1);
          nextCell.remove();
        }
        break;
      case 'deleteTable':
        table.remove();
        break;
      default:
        break;
    }
    triggerChange && triggerChange();
  };

  const insertTable = () => {
    const rows = parseInt(tableRows) || 3;
    const cols = parseInt(tableCols) || 3;
    let tableHtml = '<table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin: 16px 0;"><tbody>';
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHtml += '<td style="border: 1px solid #e5e7eb; padding: 12px; min-height: 20px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p>&nbsp;</p>';
    
    if (selectionRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(selectionRangeRef.current);
    }

    document.execCommand("insertHTML", false, tableHtml);
    setTableModalOpen(false);
    triggerChange && triggerChange();
  };

  const parseVideoUrl = (url) => {
    url = url.trim();
    if (!url) return null;

    // YouTube
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|watch\?vi=|\&vi=)([^#\&\?]*).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) {
      return `https://www.youtube.com/embed/${ytMatch[2]}`;
    }

    // Vimeo
    const vimeoRegExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
    const vimeoMatch = url.match(vimeoRegExp);
    if (vimeoMatch && vimeoMatch[3]) {
      return `https://player.vimeo.com/video/${vimeoMatch[3]}`;
    }

    // DailyMotion
    const dmRegExp = /dailymotion\.com\/video\/([a-zA-Z0-9]+)/;
    const dmMatch = url.match(dmRegExp);
    if (dmMatch && dmMatch[1]) {
      return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
    }

    return null;
  };

  const insertVideo = () => {
    const embedUrl = parseVideoUrl(videoUrl);

    if (embedUrl) {
      if (editorRef.current) {
        editorRef.current.focus();
      }

      if (selectionRangeRef.current) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(selectionRangeRef.current);
      }

      const embedHtml = `<div class="video-container">
        <iframe 
          src="${embedUrl}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen
        ></iframe>
      </div><p>&nbsp;</p>`;
      
      try {
        document.execCommand("insertHTML", false, embedHtml);
      } catch (err) {
        console.error("Failed to insert Video HTML:", err);
        if (editorRef.current) {
          const div = document.createElement('div');
          div.innerHTML = embedHtml;
          editorRef.current.appendChild(div);
        }
      }
      setVideoModalOpen(false);
      setVideoUrl("");
      triggerChange && triggerChange();
    } else {
      console.warn("Invalid Video URL or Platform not supported");
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
      // ONLY wrap if it's not already inside a wrapper
      const existingWrapper = img.closest(".image-container");
      if (existingWrapper) {
        // Just update existing wrapper state if needed
        existingWrapper.style.cursor = editable ? 'pointer' : 'default';
        const deleteBtn = existingWrapper.querySelector('.image-delete-button');
        if (deleteBtn) {
          deleteBtn.style.display = editable ? 'flex' : 'none';
        }
        return;
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

  /* 
     Advanced Tip: Use the 'onImageUpload' prop to handle file uploads to a server 
     instead of using base64. If 'onImageUpload' is provided, it should return a URL string.
  */
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
    if (editorRef.current) {
      const next = editorRef.current.innerHTML;
      setHtml(next);
      lastSynchronizedHtmlRef.current = next;
      onChange && onChange(next);
      updateMetrics();
    }
  }, [onChange, updateMetrics]);

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
    setSelectionVersion(v => v + 1);
    // Check if the click is on a link
    const clickedLink = e.target.closest('a');

    if (clickedLink) {
      e.preventDefault();
      e.stopPropagation();
      window.open(clickedLink.href, '_blank');
      return;
    }

    // NEW: Check if click is on an image for resizing
    const clickedImg = e.target.closest('img');
    if (clickedImg && !clickedImg.closest('.rte-modal')) {
      setSelectedImage(clickedImg);
    } else if (!e.target.closest('.rte-image-toolbar')) {
      setSelectedImage(null);
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

  const renderImageToolbar = () => {
    if (!selectedImage || !editorRef.current || !editable) return null;

    const editorRect = editorRef.current.getBoundingClientRect();
    const imgRect = selectedImage.getBoundingClientRect();

    const top = imgRect.top - editorRect.top + editorRef.current.scrollTop;
    const left = imgRect.left - editorRect.left + editorRef.current.scrollLeft;
    const width = imgRect.width;

    const handleAlignment = (align) => {
      const wrapper = selectedImage.closest('.image-container');
      if (wrapper) {
        // Remove all alignment classes first
        wrapper.classList.remove('image-align-left', 'image-align-center', 'image-align-right');
        // Add the new alignment class
        wrapper.classList.add(`image-align-${align}`);
        selectedImage.setAttribute('data-align', align);
        triggerChange();
      }
    };

    const removeImage = () => {
      const wrapper = selectedImage.closest('.image-container');
      if (wrapper) {
        wrapper.remove();
        setSelectedImage(null);
        triggerChange();
      }
    };

    const toggleSize = () => {
      const wrapper = selectedImage.closest('.image-container');
      if (wrapper) {
        const isSmall = wrapper.classList.contains('image-small');
        if (isSmall) {
          wrapper.classList.remove('image-small');
        } else {
          wrapper.classList.add('image-small');
        }
        triggerChange();
      }
    };

    return (
      <div 
        className="rte-image-toolbar"
        style={{ 
          position: 'absolute', 
          top: Math.max(0, top - 45), 
          left: Math.max(0, left + width / 2 - 80),
          zIndex: 1000
        }}
      >
        <button type="button" onClick={() => handleAlignment('left')} title="Align Left">L</button>
        <button type="button" onClick={() => handleAlignment('center')} title="Align Center">C</button>
        <button type="button" onClick={() => handleAlignment('right')} title="Align Right">R</button>
        <button type="button" onClick={toggleSize} title="Toggle 50% Width">50%</button>
        <button type="button" onClick={removeImage} className="danger" title="Remove Image">×</button>
      </div>
    );
  };

  

  return (
    <div className="rte-main-wrapper" style={{ width: '100%', position: 'relative' }}>
      {label && <LabelComponent>{label}</LabelComponent>}
      <div
        style={{ position: 'relative' }}
        className={!showBorder ? "" : "rte-container"}
        onClick={handleEditorClick}
        onMouseOver={(e) => {
          const table = e.target.closest('table');
          if (table && editorRef.current.contains(table)) {
            setHoveredTable(table);
          }
        }}
        onMouseOut={(e) => {
          const table = e.target.closest('table');
          const related = e.relatedTarget;
          if (table && (!related || !table.contains(related)) && !related?.closest('.rte-table-delete-hover')) {
             setHoveredTable(null);
          }
        }}
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
                handleInput();
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
                handleInput();
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
                handleInput();
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

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>
            
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

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Table */}
            <button
              type="button"
              title="Insert Table"
              className="rte-toolbar-button"
              onMouseDown={(e) => {
                e.preventDefault();
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                  selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
                setTableModalOpen(true);
              }}
            >
              <FaTable size={14} />
            </button>

            {/* Video */}
            <button
              type="button"
              title="Embed Video (YouTube, Vimeo, etc.)"
              className={`rte-toolbar-button ${videoModalOpen ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                setVideoModalOpen(true);
              }}
            >
              <FaVideo size={14} />
            </button>

            {/* Table Actions (Conditional) */}
            {(() => {
              if (typeof window === "undefined") return null;
              const sel = window.getSelection();
              // Robust check: inside cell OR the table itself is selected
              const isCell = sel && sel.rangeCount > 0 && sel.anchorNode && (findParentTag(sel.anchorNode, 'TD') || findParentTag(sel.anchorNode, 'TH'));
              const isTable = sel && sel.rangeCount > 0 && sel.anchorNode && findParentTag(sel.anchorNode, 'TABLE');
              
              if (isCell || isTable) {
                return (
                  <>
                    <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>
                    <button type="button" title="Add Row Above" className="rte-toolbar-button" onMouseDown={(e) => { e.preventDefault(); tableAction('addRowAbove'); }}>+R↑</button>
                    <button type="button" title="Add Row Below" className="rte-toolbar-button" onMouseDown={(e) => { e.preventDefault(); tableAction('addRowBelow'); }}>+R↓</button>
                    <button type="button" title="Add Col Before" className="rte-toolbar-button" onMouseDown={(e) => { e.preventDefault(); tableAction('addColBefore'); }}>+C←</button>
                    <button type="button" title="Add Col After" className="rte-toolbar-button" onMouseDown={(e) => { e.preventDefault(); tableAction('addColAfter'); }}>+C→</button>
                    <button type="button" title="Merge Cells (Right)" className="rte-toolbar-button" onMouseDown={(e) => { e.preventDefault(); tableAction('mergeRight'); }}><FaObjectGroup size={14} /></button>
                   <div style={{ display: 'flex', gap: '10px' }}>
  <button
    type="button"
    title="Delete Row"
    className="rte-toolbar-button rte-toolbar-button-danger"
    onMouseDown={(e) => { e.preventDefault(); tableAction('deleteRow'); }}
  >
    <FaTrash size={12} />
    <span style={{ fontSize: '10px' }}>Row</span>
  </button>

  <button
    type="button"
    title="Delete Column"
    className="rte-toolbar-button rte-toolbar-button-danger"
    onMouseDown={(e) => { e.preventDefault(); tableAction('deleteCol'); }}
  >
    <FaTrash size={12} />
    <span style={{ fontSize: '10px' }}>Col</span>
  </button>

  <button
    type="button"
    title="Delete Table"
    className="rte-toolbar-button rte-toolbar-button-danger"
    onMouseDown={(e) => { e.preventDefault(); tableAction('deleteTable'); }}
  >
    <FaTrash size={12} />
    <span style={{ fontSize: '10px' }}>Table</span>
  </button>
</div>
                  </>
                );
              }
              return null;
            })()}
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
        {renderImageToolbar()}

        
        {/* Footer with Character/Word Count */}
        <div className="rte-footer">
          <div className="rte-footer-content">
            <span className="rte-footer-item"><b>{metrics.words}</b> words</span>
            <span className="rte-footer-separator">•</span>
            <span className="rte-footer-item"><b>{metrics.chars}</b> characters</span>
          </div>
        </div>
        {linkModalOpen && (
          <div className="rte-modal-overlay" onClick={cancelLink}>
            <div className="rte-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="rte-modal-title">Insert Link</h3>
              <div className="rte-modal-divider"></div>
              <div className="rte-modal-body">
                <div className="rte-form-group">
                  <label className="rte-label">Link Text</label>
                  <input
                    type="text"
                    className="rte-input"
                    placeholder="e.g. Google"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                  />
                </div>
                <div className="rte-form-group">
                  <label className="rte-label">URL</label>
                  <input
                    type="text"
                    className="rte-input"
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmLink()}
                    autoFocus
                  />
                </div>
              </div>
              <div className="rte-modal-divider" style={{ margin: '8px 0 20px 0' }}></div>
              <div className="rte-modal-footer">
                <button type="button" className="rte-btn rte-btn-secondary" onClick={cancelLink}>Cancel</button>
                <button type="button" className="rte-btn rte-btn-primary" onClick={confirmLink} disabled={!linkUrl}>Insert</button>
              </div>
            </div>
          </div>
        )}

        {/* Table Modal */}
        {tableModalOpen && (
          <div className="rte-modal-overlay" onClick={() => setTableModalOpen(false)}>
            <div className="rte-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="rte-modal-title">Insert Table</h3>
              <div className="rte-form-group">
                <label className="rte-label">Rows</label>
                <input type="number" className="rte-input" value={tableRows} onChange={(e) => setTableRows(e.target.value)} min="1" max="10" />
              </div>
              <div className="rte-form-group">
                <label className="rte-label">Columns</label>
                <input type="number" className="rte-input" value={tableCols} onChange={(e) => setTableCols(e.target.value)} min="1" max="10" />
              </div>
              <div className="rte-modal-actions">
                <button type="button" className="rte-button rte-button-secondary" onClick={() => setTableModalOpen(false)}>Cancel</button>
                <button type="button" className="rte-button rte-button-primary" onClick={insertTable}>Insert</button>
              </div>
            </div>
          </div>
        )}

        {/* Video Modal */}
        {videoModalOpen && (
          <div className="rte-modal-overlay" onClick={() => setVideoModalOpen(false)}>
            <div className="rte-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rte-modal-header">
                <h3 className="rte-modal-title">Embed Video</h3>
              </div>
              <div className="rte-form-group">
                <label className="rte-label">Paste Video URL (YouTube, Vimeo...) <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  className="rte-input" 
                  value={videoUrl} 
                  onChange={(e) => setVideoUrl(e.target.value)} 
                  placeholder="Paste URL here..." 
                  autoFocus 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && videoUrl.trim()) insertVideo();
                    if (e.key === 'Escape') setVideoModalOpen(false);
                  }}
                />
              </div>
              <div className="rte-modal-actions">
                <button type="button" className="rte-button rte-button-secondary" onClick={() => setVideoModalOpen(false)}>Cancel</button>
                <button 
                  type="button" 
                  className="rte-button rte-button-primary" 
                  onClick={() => {
                    if (videoUrl.trim()) {
                      insertVideo();
                    }
                  }}
                  disabled={!videoUrl.trim()}
                >
                  Embed Video
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
              onChange && onChange(html);
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
