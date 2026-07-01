import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaImage, FaBold, FaItalic, FaUnderline, FaTextHeight, FaAlignCenter, FaAlignRight, FaAlignJustify, FaAlignLeft, FaListOl, FaListUl, FaFont, FaLink, FaTable, FaYoutube, FaVideo, FaTrash, FaObjectGroup } from "./icons";
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

const rectsIntersect = (a, b) =>
  !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

const caretRangeFromClientPoint = (x, y) => {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }
  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
};

const clipRectToBounds = (rect, bounds) => {
  const left = Math.max(rect.left, bounds.left);
  const top = Math.max(rect.top, bounds.top);
  const right = Math.min(rect.right, bounds.right);
  const bottom = Math.min(rect.bottom, bounds.bottom);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const BLOCK_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, blockquote, li, td, th, div:not(.rte-area-highlight-block):not(.image-container):not(.video-container):not(.image-media-frame)";

const getIntersectingBlocks = (editor, clientRect) => {
  const candidates = [...editor.querySelectorAll(BLOCK_SELECTOR)].filter((el) => {
    if (el === editor || !editor.contains(el)) return false;
    if (el.closest(".rte-area-highlight-block, .image-container, .video-container")) {
      return false;
    }
    return rectsIntersect(el.getBoundingClientRect(), clientRect);
  });

  return candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el))
  );
};

const insertAreaHighlightRegion = (editor, clientRect, color) => {
  const editorRect = editor.getBoundingClientRect();
  const clipped = clipRectToBounds(clientRect, editorRect);
  const widthPx = Math.max(40, Math.round(clipped.width));
  const heightPx = Math.max(24, Math.round(clipped.height));

  const region = document.createElement("div");
  region.className = "rte-area-highlight-block";
  region.style.backgroundColor = color;
  region.style.minHeight = `${heightPx}px`;
  region.style.width = `${widthPx}px`;
  region.style.maxWidth = "100%";
  region.style.boxSizing = "border-box";
  region.style.padding = "12px";
  region.style.borderRadius = "4px";
  region.style.margin = "8px 0";
  region.style.display = "block";

  const blocks = getIntersectingBlocks(editor, clipped);

  if (blocks.length > 0) {
    const first = blocks[0];
    if (first.parentNode) {
      first.parentNode.insertBefore(region, first);
    } else {
      editor.appendChild(region);
    }

    blocks.forEach((block) => {
      block.style.backgroundColor = "";
      block.style.borderRadius = "";
      region.appendChild(block);
    });
    return true;
  }

  const insertRange =
    caretRangeFromClientPoint(
      clipped.left + clipped.width / 2,
      clipped.top + Math.min(8, clipped.height / 2)
    ) ||
    caretRangeFromClientPoint(clipped.left + 4, clipped.top + 4);

  region.innerHTML = "&nbsp;";

  if (insertRange && editor.contains(insertRange.startContainer)) {
    insertRange.collapse(true);
    let node = insertRange.startContainer;
    if (node.nodeType === 3) node = node.parentNode;

    while (node && node !== editor && node.parentNode !== editor) {
      node = node.parentNode;
    }

    if (node && node !== editor && editor.contains(node)) {
      node.parentNode.insertBefore(region, node);
    } else {
      editor.appendChild(region);
    }
  } else {
    editor.appendChild(region);
  }

  return true;
};

const getClientRectFromDrag = (startX, startY, currentX, currentY) => {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const right = Math.max(startX, currentX);
  const bottom = Math.max(startY, currentY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

export default function RichTextEditor({
  onChange,
  showEditButton,
  onBlur,
  disabled = false,
  editable: initialEditable = true,
  value,
  isLoading,
  isList = false,
  label,
  placeholder = "Type here...",
  showBorder = true,
  paddingLeft,
  minHeight,
  maxHeight,
  onImageUpload,
}) {

  const editorRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollTopRef = useRef(0);
  const areaDragRef = useRef(null);
  const bgColorRef = useRef("#ffff00");

  const [html, setHtml] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const selectionRangeRef = useRef(null);
  const [editable, setEditable] = useState(initialEditable);
  const [editorFocused, setEditorFocused] = useState(false);
  const lastSynchronizedHtmlRef = useRef("");
  const syncProcessedMediaRef = useRef(() => {});

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
  const [currentBlockFormat, setCurrentBlockFormat] = useState("div");

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

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaWidthInput, setMediaWidthInput] = useState("100");
  const [mediaWidthUnit, setMediaWidthUnit] = useState("%");
  const [metrics, setMetrics] = useState({ words: 0, chars: 0 });
  const [isEmpty, setIsEmpty] = useState(!value);
  const [areaHighlightMode, setAreaHighlightMode] = useState(false);
  const [marqueePreview, setMarqueePreview] = useState(null);

  const updateMetrics = useCallback(() => {
    if (!editorRef.current) return;
    // Calculate metrics immediately but outside of render path
    const text = editorRef.current.innerText || "";
    const cleanText = text.replace(/[\n\r]/g, ' ').trim();
    const words = cleanText ? cleanText.split(/\s+/).length : 0;
    const chars = text.length;
    setMetrics({ words, chars });

    // Track emptiness for the placeholder. Account for media-only content.
    const stripped = text.replace(/[\u200B\u00A0\s]/g, "");
    const hasMedia = !!editorRef.current.querySelector("img, table, iframe");
    setIsEmpty(stripped.length === 0 && !hasMedia);
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
    if (editorRef.current && value && value !== lastSynchronizedHtmlRef.current) {
      requestAnimationFrame(() => syncProcessedMediaRef.current(editorRef.current));
    }
  }, [value]);


  useEffect(() => {
    if (!editable) {
      setEditorFocused(false);
      clearMediaSelection();
    }
    syncProcessedMediaRef.current(editorRef.current);
  }, [editable]);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll(".image-container, .video-container").forEach((container) => {
      updateMediaControlVisibility(container);
    });
  }, [editorFocused, editable]);

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
          requestAnimationFrame(() => syncProcessedMediaRef.current(editorRef.current));
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

  const LIST_BLOCK_MEDIA_SELECTOR = ".video-container, .image-container, table";

  const isListItemEffectivelyEmpty = (listItem) => {
    if (!listItem) return true;
    const clone = listItem.cloneNode(true);
    clone.querySelectorAll(LIST_BLOCK_MEDIA_SELECTOR).forEach((el) => el.remove());
    clone.querySelectorAll("br").forEach((el) => el.remove());
    return clone.textContent.replace(/[\u200B\u00A0\s]/g, "").length === 0;
  };

  const hoistBlockMediaOutOfListItems = (container) => {
    if (!container) return false;

    let changed = false;
    container.querySelectorAll("ol, ul").forEach((list) => {
      const items = Array.from(list.children).filter((child) => child.tagName === "LI");

      items.forEach((listItem) => {
        const blockMedia = Array.from(listItem.querySelectorAll(LIST_BLOCK_MEDIA_SELECTOR));
        if (blockMedia.length === 0) return;

        const hadText = !isListItemEffectivelyEmpty(listItem);

        blockMedia.forEach((media) => {
          listItem.removeChild(media);
          if (list.parentNode) {
            list.parentNode.insertBefore(media, list.nextSibling);
          }
          changed = true;
        });

        if (!hadText || isListItemEffectivelyEmpty(listItem)) {
          listItem.remove();
          changed = true;
        }
      });

      if (list.children.length === 0 && list.parentNode) {
        list.remove();
        changed = true;
      }
    });

    return changed;
  };

  const processExistingMedia = (container) => {
    if (!container) return false;
    processExistingImages(container);
    processExistingVideos(container);
    return hoistBlockMediaOutOfListItems(container);
  };

  const getCleanHtml = () => {
    if (!editorRef.current) return "";
    const clone = editorRef.current.cloneNode(true);
    stripEditorChrome(clone);
    return clone.innerHTML;
  };

  // Trigger change manually
  const triggerChange = useCallback(() => {
    const next = getCleanHtml();
    setHtml(next);
    lastSynchronizedHtmlRef.current = next;
    onChange && onChange(next);
  }, [onChange]);

  syncProcessedMediaRef.current = (container) => {
    if (processExistingMedia(container)) {
      triggerChange();
    }
  };

  const handleChange = () => {
    if (!editorRef.current) return;
    onBlur && onBlur(getCleanHtml());
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
      setFontColor("#000000");
      setBgColor("#ffff00");
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
      setBgColor(getBackgroundColorAtCursor());

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
      setBgColor(getBackgroundColorAtCursor());
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

  const getColorAtCursor = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return null;

    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;

    while (node && node !== editorRef.current) {
      if (node.nodeType === 1) {
        if (node.style && node.style.color) {
          return rgbToHex(node.style.color);
        }
        if (node.tagName === "FONT" && node.getAttribute("color")) {
          return node.getAttribute("color");
        }
      }
      node = node.parentNode;
    }

    const computedColor = window.getComputedStyle(
      sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode
    ).color;
    return rgbToHex(computedColor);
  };

  const getBackgroundColorAtCursor = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return "#ffff00";

    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;

    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && node.style?.backgroundColor) {
        const bg = node.style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
          return rgbToHex(bg);
        }
      }
      node = node.parentNode;
    }

    const computedBg = window.getComputedStyle(
      sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode
    ).backgroundColor;

    if (
      !computedBg ||
      computedBg === "transparent" ||
      computedBg === "rgba(0, 0, 0, 0)"
    ) {
      return "#ffff00";
    }
    return rgbToHex(computedBg);
  };

  const stripEditorChrome = (root) => {
    root.querySelectorAll(
      ".image-delete-button, .video-delete-button, .video-edit-overlay, .media-resize-handle"
    ).forEach((element) => element.remove());
    root.querySelectorAll(".rte-media-selected").forEach((element) => {
      element.classList.remove("rte-media-selected");
    });
    return root;
  };

  const getEditorInnerWidth = () => {
    if (!editorRef.current) return 800;
    return Math.max(editorRef.current.clientWidth - 24, 200);
  };

  const ensureImageMediaFrame = (imageContainer) => {
    if (!imageContainer) return null;

    let frame = imageContainer.querySelector(":scope > .image-media-frame");
    if (frame) return frame;

    frame = document.createElement("div");
    frame.className = "image-media-frame";

    const children = Array.from(imageContainer.children);
    imageContainer.appendChild(frame);
    children.forEach((child) => frame.appendChild(child));

    return frame;
  };

  const getImageMediaTarget = (imageContainer) =>
    ensureImageMediaFrame(imageContainer) || imageContainer;

  const getMediaWidthPercent = (container) => {
    if (!container) return 100;
    if (container.dataset.widthPercent) {
      return Number(container.dataset.widthPercent);
    }
    const width = container.style.width || "";
    if (width.endsWith("%")) {
      return parseInt(width, 10) || 100;
    }
    const editorWidth = getEditorInnerWidth();
    const rect = container.getBoundingClientRect();
    if (editorWidth > 0 && rect.width > 0) {
      return Math.round((rect.width / editorWidth) * 100);
    }
    return 100;
  };

  const getMediaWidthPx = (container) => {
    if (!container) return 0;
    if (container.dataset.widthPx) {
      return Number(container.dataset.widthPx);
    }
    const width = container.style.width || "";
    if (width.endsWith("px")) {
      return parseInt(width, 10) || 0;
    }
    return Math.round(container.getBoundingClientRect().width);
  };

  const syncMediaWidthControls = (container) => {
    if (!container) return;
    if (container.dataset.widthPx) {
      setMediaWidthInput(String(getMediaWidthPx(container)));
      setMediaWidthUnit("px");
      return;
    }
    setMediaWidthInput(String(getMediaWidthPercent(container)));
    setMediaWidthUnit("%");
  };

  const applyMediaWidthPercent = (container, percent) => {
    if (!container) return;
    const clamped = Math.max(10, Math.min(100, Math.round(percent)));
    delete container.dataset.widthPx;
    container.dataset.widthPercent = String(clamped);
    container.style.width = `${clamped}%`;
    container.style.maxWidth = "100%";
    container.style.marginLeft = "";
    container.style.marginTop = "";

    if (container.classList.contains("video-container")) {
      container.style.height = "0";
      container.style.paddingBottom = "56.25%";
      return;
    }

    const frame = getImageMediaTarget(container);
    if (!frame) return;
    frame.style.width = "100%";
    frame.style.height = "";
    const img = frame.querySelector("img");
    if (img) {
      img.style.height = "auto";
      img.style.objectFit = "";
    }
  };

  const applyMediaWidthPx = (container, px) => {
    if (!container) return;
    const clamped = Math.max(20, Math.min(2000, Math.round(px)));
    delete container.dataset.widthPercent;
    container.dataset.widthPx = String(clamped);
    container.style.width = `${clamped}px`;
    container.style.maxWidth = "100%";
    container.style.marginLeft = "";
    container.style.marginTop = "";

    if (container.classList.contains("video-container")) {
      container.style.height = "0";
      container.style.paddingBottom = "56.25%";
      return;
    }

    const frame = getImageMediaTarget(container);
    if (!frame) return;
    frame.style.width = "100%";
    frame.style.height = "";
    const img = frame.querySelector("img");
    if (img) {
      img.style.height = "auto";
      img.style.objectFit = "";
    }
  };

  const normalizeMediaWidth = (container) => {
    if (!container) return;
    if (container.dataset.widthPx) {
      applyMediaWidthPx(container, Number(container.dataset.widthPx));
      return;
    }
    if (container.classList.contains("image-small")) {
      container.classList.remove("image-small");
      applyMediaWidthPercent(container, 50);
      return;
    }
    if (container.dataset.widthPercent) {
      applyMediaWidthPercent(container, Number(container.dataset.widthPercent));
      return;
    }
    const width = container.style.width || "";
    if (width.endsWith("%")) {
      applyMediaWidthPercent(container, parseInt(width, 10) || 100);
      return;
    }
    if (width.endsWith("px")) {
      applyMediaWidthPx(container, parseFloat(width));
      return;
    }
    if (container.classList.contains("video-container")) {
      applyMediaWidthPercent(container, 100);
    }
  };

  const clearMediaSelection = () => {
    editorRef.current?.querySelectorAll(".rte-media-selected").forEach((element) => {
      element.classList.remove("rte-media-selected");
    });
    setSelectedMedia(null);
  };

  const selectMediaContainer = (container) => {
    if (!container || !editorRef.current?.contains(container)) return;
    editorRef.current.querySelectorAll(".rte-media-selected").forEach((element) => {
      element.classList.remove("rte-media-selected");
    });
    container.classList.add("rte-media-selected");
    setSelectedMedia(container);
  };

  const attachMediaResizeHandle = (container) => {
    if (!container) return;
    const resizeTarget = container.classList.contains("video-container")
      ? container
      : getImageMediaTarget(container);
    if (!resizeTarget) return;

    resizeTarget.querySelector(".media-resize-handle")?.remove();

    const handle = document.createElement("div");
    handle.className = "media-resize-handle";
    handle.title = "Drag to resize";
    handle.setAttribute("contenteditable", "false");

    handle.addEventListener("mousedown", (event) => {
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      selectMediaContainer(container);

      const editorWidth = getEditorInnerWidth();
      const startX = event.clientX;
      const startWidth = container.getBoundingClientRect().width;

      const onMouseMove = (moveEvent) => {
        const nextWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
        if (container.dataset.widthPx) {
          applyMediaWidthPx(container, nextWidth);
        } else {
          const percent = Math.round((nextWidth / editorWidth) * 100);
          applyMediaWidthPercent(container, percent);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        syncMediaWidthControls(container);
        setSelectionVersion((v) => v + 1);
        triggerChange();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    resizeTarget.appendChild(handle);
  };

  const handleEditorFocus = () => {
    setEditorFocused(true);
  };

  const handleEditorBlur = () => {
    requestAnimationFrame(() => {
      if (!editorRef.current?.contains(document.activeElement)) {
        setEditorFocused(false);
      }
    });
  };

  const updateMediaControlVisibility = (container) => {
    const handle = container.querySelector(".media-resize-handle");
    if (handle instanceof HTMLElement) {
      handle.style.display = editable ? "block" : "none";
      handle.style.pointerEvents = editable ? "auto" : "none";
    }
  };

  const BLOCK_TAGS = ["P", "DIV", "H1", "H2", "H3", "BLOCKQUOTE", "LI"];

  const getActiveBlock = (node) => {
    if (!editorRef.current || !node) return null;
    let current = node.nodeType === 3 ? node.parentNode : node;

    while (current && current !== editorRef.current) {
      if (current.nodeType === 1 && BLOCK_TAGS.includes(current.tagName)) {
        return current;
      }
      current = current.parentNode;
    }

    return editorRef.current;
  };

  const getBlockFormat = (node) => {
    const block = getActiveBlock(node);
    if (!block || block === editorRef.current) return "div";
    const tag = block.tagName.toLowerCase();
    return tag === "p" || tag === "li" ? "div" : tag;
  };

  const createMediaDeleteButton = (title, className, onRemove) => {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.innerHTML = "×";
    deleteBtn.className = className;
    deleteBtn.title = title;
    deleteBtn.setAttribute("contenteditable", "false");
    deleteBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRemove();
    };
    return deleteBtn;
  };


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

      setCurrentBlockFormat(getBlockFormat(sel.anchorNode));
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
  const [bgColor, setBgColor] = useState("#ffff00");

  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  const getActiveTextColor = () => getColorAtCursor() || fontColor;

  const restoreSavedSelection = () => {
    if (!selectionRangeRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(selectionRangeRef.current);
  };

  const applyTextColor = (color) => {
    setFontColor(color);
    focus();
    restoreSavedSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, color);
    document.execCommand("styleWithCSS", false, false);
    triggerChange();
  };

  const applyBackgroundColor = (color) => {
    setBgColor(color);
    focus();
    restoreSavedSelection();
    document.execCommand("styleWithCSS", false, true);
    if (!document.execCommand("hiliteColor", false, color)) {
      document.execCommand("backColor", false, color);
    }
    document.execCommand("styleWithCSS", false, false);
    triggerChange();
  };

  const applyMarqueeHighlight = useCallback((clientRect, color) => {
    const editor = editorRef.current;
    if (!editor || clientRect.width < 10 || clientRect.height < 10) {
      return;
    }

    editor.focus();

    const editorRect = editor.getBoundingClientRect();
    const clippedRect = clipRectToBounds(clientRect, editorRect);
    if (clippedRect.width < 10 || clippedRect.height < 10) {
      return;
    }

    insertAreaHighlightRegion(editor, clippedRect, color);

    editor.querySelectorAll("td, th").forEach((cell) => {
      if (!editor.contains(cell)) return;
      if (cell.closest(".rte-area-highlight-block")) return;
      if (rectsIntersect(cell.getBoundingClientRect(), clippedRect)) {
        cell.style.backgroundColor = color;
      }
    });

    editor.querySelectorAll(".image-container, .video-container").forEach((media) => {
      if (!editor.contains(media)) return;
      if (rectsIntersect(media.getBoundingClientRect(), clippedRect)) {
        media.style.backgroundColor = color;
        media.style.padding = "4px";
        media.style.borderRadius = "4px";
      }
    });

    updateMetrics();
    triggerChange();
    focus();
  }, [triggerChange, updateMetrics]);

  const handleAreaSelectMouseDown = useCallback((e) => {
    if (!areaHighlightMode || !editable || disabled) return;
    if (e.button !== 0) return;
    if (e.target.closest(".rte-toolbar, .rte-media-toolbar, .rte-modal-overlay")) return;

    e.preventDefault();
    e.stopPropagation();

    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    areaDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      wrapperRect,
    };

    const updatePreview = (clientX, clientY) => {
      const drag = areaDragRef.current;
      if (!drag) return;

      drag.currentX = clientX;
      drag.currentY = clientY;

      const rect = getClientRectFromDrag(
        drag.startX,
        drag.startY,
        drag.currentX,
        drag.currentY
      );

      setMarqueePreview({
        left: rect.left - drag.wrapperRect.left,
        top: rect.top - drag.wrapperRect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    const onMove = (ev) => {
      ev.preventDefault();
      updatePreview(ev.clientX, ev.clientY);
    };

    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const drag = areaDragRef.current;
      areaDragRef.current = null;
      setMarqueePreview(null);

      if (!drag) return;

      const clientRect = getClientRectFromDrag(
        drag.startX,
        drag.startY,
        ev.clientX,
        ev.clientY
      );

      requestAnimationFrame(() => {
        applyMarqueeHighlight(clientRect, bgColorRef.current);
      });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    updatePreview(e.clientX, e.clientY);
  }, [areaHighlightMode, editable, disabled, applyMarqueeHighlight]);

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
      requestAnimationFrame(() => {
        processExistingMedia(editorRef.current);
        triggerChange();
      });
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

  const processExistingVideos = (container) => {
    if (!container) return;

    container.querySelectorAll(".video-container").forEach((videoContainer) => {
      if (!videoContainer.querySelector(".video-delete-button")) {
        const deleteBtn = createMediaDeleteButton(
          "Remove video",
          "video-delete-button image-delete-button",
          () => {
            videoContainer.remove();
            clearMediaSelection();
            triggerChange && triggerChange();
          }
        );
        videoContainer.appendChild(deleteBtn);
      }

      if (!videoContainer.dataset.mediaEnhanced) {
        videoContainer.dataset.mediaEnhanced = "true";
        if (!videoContainer.classList.contains("image-align-left") &&
            !videoContainer.classList.contains("image-align-center") &&
            !videoContainer.classList.contains("image-align-right")) {
          videoContainer.classList.add("image-align-left");
        }
        videoContainer.addEventListener("click", (event) => {
          if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
          event.preventDefault();
          event.stopPropagation();
          selectMediaContainer(videoContainer);
        });
      }

      attachMediaResizeHandle(videoContainer);
      normalizeMediaWidth(videoContainer);
      updateMediaControlVisibility(videoContainer);
    });
  };

  const processExistingImages = (container) => {
    if (!container) return;

    container.querySelectorAll("img").forEach((img) => {
      if (img.closest(".rte-modal")) return;

      const existingWrapper = img.closest(".image-container");
      if (existingWrapper) {
        existingWrapper.style.cursor = editable ? "pointer" : "default";
        const frame = ensureImageMediaFrame(existingWrapper);
        if (frame && !frame.querySelector(".image-delete-button")) {
          frame.appendChild(
            createMediaDeleteButton(
              "Remove image",
              "image-delete-button",
              () => {
                existingWrapper.remove();
                clearMediaSelection();
                triggerChange && triggerChange();
              }
            )
          );
        }
        if (!existingWrapper.dataset.mediaEnhanced) {
          existingWrapper.dataset.mediaEnhanced = "true";
          existingWrapper.addEventListener("click", (event) => {
            if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
            event.preventDefault();
            event.stopPropagation();
            selectMediaContainer(existingWrapper);
          });
          img.addEventListener("dblclick", (event) => {
            if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
            event.preventDefault();
            event.stopPropagation();
            openImageModal(img.src);
          });
        }
        attachMediaResizeHandle(existingWrapper);
        normalizeMediaWidth(existingWrapper);
        updateMediaControlVisibility(existingWrapper);
        return;
      }

      const wrapper = document.createElement("div");
      const align = img.getAttribute("data-align") || img.closest("[data-align]")?.getAttribute("data-align") || "left";
      wrapper.className = `image-container image-align-${align}`;
      wrapper.style.cursor = editable ? "pointer" : "default";

      const frame = document.createElement("div");
      frame.className = "image-media-frame";

      img.classList.add("rte-image");
      img.setAttribute("data-align", align);
      img.style.height = "auto";

      img.addEventListener("dblclick", (event) => {
        if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
        event.preventDefault();
        event.stopPropagation();
        openImageModal(img.src);
      });

      img.addEventListener("click", (event) => {
        if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
        event.preventDefault();
        event.stopPropagation();
        selectMediaContainer(wrapper);
      });

      const deleteBtn = createMediaDeleteButton(
        "Remove image",
        "image-delete-button",
        () => {
          wrapper.remove();
          triggerChange && triggerChange();
        }
      );

      const { parentNode, nextSibling } = img;
      if (parentNode) {
        parentNode.removeChild(img);
        frame.appendChild(img);
        frame.appendChild(deleteBtn);
        wrapper.appendChild(frame);
        attachMediaResizeHandle(wrapper);
        normalizeMediaWidth(wrapper);

        if (nextSibling) {
          parentNode.insertBefore(wrapper, nextSibling);
        } else {
          parentNode.appendChild(wrapper);
        }
      }
    });
  };


  /* 
     Advanced Tip: Use the 'onImageUpload' prop to handle file uploads to a server 
     instead of using base64. If 'onImageUpload' is provided, it should return a URL string.
  */
  const insertImage = async (dataUrl, fileName) => {
    try {
      if (editable) {

        // Create container for the image
        const container = document.createElement('div');
        container.className = 'image-container image-align-left';

        const frame = document.createElement('div');
        frame.className = 'image-media-frame';

        // Create image element
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = fileName || "image";
        img.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openImageModal(dataUrl);
        });
        img.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectMediaContainer(container);
        });

        container.style.cursor = editable ? "pointer" : "default";
        container.dataset.mediaEnhanced = "true";
        container.addEventListener("click", (event) => {
          if (event.target.closest(".image-delete-button, .media-resize-handle")) return;
          event.preventDefault();
          event.stopPropagation();
          selectMediaContainer(container);
        });

        const deleteBtn = createMediaDeleteButton(
          "Remove image",
          "image-delete-button",
          () => {
            container.remove();
            clearMediaSelection();
            triggerChange();
          }
        );

        frame.appendChild(img);
        frame.appendChild(deleteBtn);
        container.appendChild(frame);
        attachMediaResizeHandle(container);
        applyMediaWidthPercent(container, 50);

        // Insert at cursor position
        insertNodeAtCursor(container);
        requestAnimationFrame(() => {
          processExistingMedia(editorRef.current);
          selectMediaContainer(container);
          syncMediaWidthControls(container);
          editorRef.current?.focus();
          triggerChange();
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

  // Helper function to unescape HTML entities
  const unescapeHtml = (html) => {
    if (!html) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const isCursorAtStartOfListItem = (range, listItem) => {
    const prefixRange = document.createRange();
    prefixRange.setStart(listItem, 0);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    return prefixRange.toString().replace(/[\u200B\u00A0\s]/g, "").length === 0;
  };

  const isCursorAtEndOfListItem = (range, listItem) => {
    const suffixRange = document.createRange();
    suffixRange.setStart(range.startContainer, range.startOffset);
    suffixRange.setEnd(listItem, listItem.childNodes.length);
    return suffixRange.toString().replace(/\u200B/g, "").length === 0;
  };

  const prepareListItemForTyping = (listItem, selection) => {
    const activeColor = getActiveTextColor();
    const newRange = document.createRange();

    if (activeColor && activeColor.toLowerCase() !== "#000000") {
      const span = document.createElement("span");
      span.style.color = activeColor;
      span.appendChild(document.createTextNode("\u200B"));
      listItem.appendChild(span);
      newRange.setStart(span.firstChild, 1);
    } else {
      listItem.appendChild(document.createTextNode("\u200B"));
      newRange.setStart(listItem.firstChild, 1);
    }

    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      if (areaHighlightMode) {
        e.preventDefault();
        areaDragRef.current = null;
        setMarqueePreview(null);
        setAreaHighlightMode(false);
        return;
      }
      if (selectedMedia) {
        e.preventDefault();
        clearMediaSelection();
        return;
      }
    }

    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedMedia?.classList.contains("rte-media-selected") &&
      editorRef.current?.contains(selectedMedia)
    ) {
      e.preventDefault();
      selectedMedia.remove();
      clearMediaSelection();
      triggerChange();
      return;
    }

    if (applyMarkdownShortcut(e)) return;

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

        // Create a new list item
        const newItem = document.createElement('li');

        // If we're at the end of a list item, add a new one
        if (range.collapsed && isCursorAtEndOfListItem(range, listItem)) {
          // If it's empty, create a regular paragraph instead
          if (isListItemEffectivelyEmpty(listItem)) {
            document.execCommand('insertHTML', false, '<div><br></div>');
            // Move the cursor to the new line
            const newRange = document.createRange();
            const newDiv = editorRef.current.lastElementChild;
            newRange.setStart(newDiv, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            triggerChange();
            return;
          }

          // Insert new list item
          if (listItem.nextSibling) {
            list.insertBefore(newItem, listItem.nextSibling);
          } else {
            list.appendChild(newItem);
          }

          prepareListItemForTyping(newItem, selection);
        } else {
          // If we're in the middle of text, split the list item while preserving formatting
          const afterRange = document.createRange();
          afterRange.setStart(range.startContainer, range.startOffset);
          afterRange.setEnd(listItem, listItem.childNodes.length);
          const movedFragment = afterRange.extractContents();
          newItem.appendChild(movedFragment);

          if (listItem.nextSibling) {
            list.insertBefore(newItem, listItem.nextSibling);
          } else {
            list.appendChild(newItem);
          }

          if (isListItemEffectivelyEmpty(newItem)) {
            newItem.textContent = "";
            prepareListItemForTyping(newItem, selection);
          } else {
            const newRange = document.createRange();
            newRange.setStart(newItem, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      } else {
        // Regular text, insert a new paragraph
        document.execCommand('insertHTML', false, '<div><br></div>');
      }

      triggerChange();
      return;
    }

    if (e.key === "Backspace") {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return;

      let node = range.startContainer;
      if (node.nodeType === 3) {
        node = node.parentNode;
      }

      const listItem = node.closest?.("li");
      if (!listItem || !editorRef.current?.contains(listItem)) return;

      const list = listItem.parentNode;

      if (isListItemEffectivelyEmpty(listItem)) {
        e.preventDefault();

        const prevLi = listItem.previousElementSibling;
        const blockMedia = Array.from(listItem.querySelectorAll(LIST_BLOCK_MEDIA_SELECTOR));

        blockMedia.forEach((media) => {
          list.parentNode?.insertBefore(media, list.nextSibling);
        });

        listItem.remove();

        if (list.children.length === 0) {
          list.remove();
        }

        if (prevLi?.tagName === "LI") {
          const newRange = document.createRange();
          newRange.selectNodeContents(prevLi);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        triggerChange();
        return;
      }

      if (isCursorAtStartOfListItem(range, listItem)) {
        const prevLi = listItem.previousElementSibling;
        if (prevLi?.tagName === "LI" && isListItemEffectivelyEmpty(prevLi)) {
          e.preventDefault();
          prevLi.remove();
          if (list.children.length === 0) {
            list.remove();
          }
          triggerChange();
        }
      }
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
  }, [exec, triggerChange, fontColor, areaHighlightMode, selectedMedia]);

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

  const applyBlockFormat = (format) => {
    document.execCommand("formatBlock", false, format);
    setCurrentBlockFormat(format);
    triggerChange();
    focus();
  };

  const clearFormatting = () => {
    document.execCommand("removeFormat", false, null);
    document.execCommand("unlink", false, null);
    document.execCommand("formatBlock", false, "div");
    setCurrentBlockFormat("div");
    setCurrentFontSize("16");
    setCurrentLineHeight("");
    setFontColor("#000000");
    setBgColor("#ffff00");
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("hiliteColor", false, "transparent");
    document.execCommand("backColor", false, "transparent");
    document.execCommand("styleWithCSS", false, false);
    triggerChange();
    focus();
  };

  const deleteTextBeforeCursorInBlock = (block, range, selection) => {
    const prefixRange = document.createRange();
    prefixRange.setStart(block, 0);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    prefixRange.deleteContents();

    const nextRange = document.createRange();
    nextRange.setStart(block, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  };

  const applyMarkdownShortcut = (event) => {
    if (event.key !== " " || event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed || !editorRef.current) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const block = getActiveBlock(range.startContainer);
    if (!block || !editorRef.current.contains(block)) return false;

    const prefixRange = document.createRange();
    prefixRange.setStart(block, 0);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    const textBeforeCursor = prefixRange.toString().replace(/\u00A0/g, " ").trim();

    const shortcuts = {
      "#": () => applyBlockFormat("h1"),
      "##": () => applyBlockFormat("h2"),
      "###": () => applyBlockFormat("h3"),
      ">": () => applyBlockFormat("blockquote"),
      "-": () => handleSelect("unordered"),
      "*": () => handleSelect("unordered"),
      "1.": () => handleSelect("ordered"),
    };

    const action = shortcuts[textBeforeCursor];
    if (!action) return false;

    event.preventDefault();
    deleteTextBeforeCursorInBlock(block, range, selection);
    action();
    return true;
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
      const next = getCleanHtml();
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
    if (areaHighlightMode) {
      e.preventDefault();
      return;
    }

    setSelectionVersion(v => v + 1);

    const deleteBtn = e.target.closest(
      'button[title="Remove image"], button[title="Remove video"]'
    );
    if (deleteBtn && editable && editorFocused) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = deleteBtn.closest('.image-container, .video-container');
      if (wrapper) {
        wrapper.remove();
        clearMediaSelection();
        triggerChange();
      }
      return;
    }

    const clickedMedia = e.target.closest('.image-container, .video-container');
    if (clickedMedia && editorRef.current?.contains(clickedMedia) && editable) {
      e.preventDefault();
      e.stopPropagation();
      selectMediaContainer(clickedMedia);
      return;
    }

    // Check if the click is on a link
    const clickedLink = e.target.closest('a');

    if (clickedLink) {
      e.preventDefault();
      e.stopPropagation();
      window.open(clickedLink.href, '_blank');
      return;
    }

    if (!e.target.closest('.rte-media-toolbar')) {
      clearMediaSelection();
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
  }, [areaHighlightMode, editable, disabled, editorFocused, triggerChange]);

  useEffect(() => {
    if (!selectedMedia) return;
    syncMediaWidthControls(selectedMedia);
  }, [selectedMedia, selectionVersion]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selectedMedia) return;

    const bumpToolbarPosition = () => setSelectionVersion((v) => v + 1);
    editor.addEventListener("scroll", bumpToolbarPosition, { passive: true });
    window.addEventListener("resize", bumpToolbarPosition, { passive: true });

    return () => {
      editor.removeEventListener("scroll", bumpToolbarPosition);
      window.removeEventListener("resize", bumpToolbarPosition);
    };
  }, [selectedMedia]);

  const renderMediaToolbar = () => {
    if (!selectedMedia || !editorRef.current || !editable) return null;

    const wrapperEl = contentWrapperRef.current;
    const anchorRect = wrapperEl?.getBoundingClientRect() ?? editorRef.current.getBoundingClientRect();
    const mediaRect = selectedMedia.getBoundingClientRect();
    const relTop = mediaRect.top - anchorRect.top;
    const relLeft = mediaRect.left - anchorRect.left;
    const mediaWidth = mediaRect.width;
    const mediaHeight = mediaRect.height;
    const currentPercent = getMediaWidthPercent(selectedMedia);
    const widthPresets = [25, 50, 75, 100];
    const toolbarWidth = 340;
    const toolbarHeight = 40;
    const gap = 8;
    const preferredTop = relTop - toolbarHeight - gap;
    const toolbarTop =
      preferredTop >= 4 ? preferredTop : relTop + mediaHeight + gap;

    const applyCustomMediaWidth = () => {
      const num = parseFloat(mediaWidthInput);
      if (isNaN(num) || num <= 0) {
        syncMediaWidthControls(selectedMedia);
        return;
      }
      if (mediaWidthUnit === "px") {
        applyMediaWidthPx(selectedMedia, num);
      } else {
        applyMediaWidthPercent(selectedMedia, num);
      }
      syncMediaWidthControls(selectedMedia);
      setSelectionVersion((v) => v + 1);
      triggerChange();
    };

    const handleUnitChange = (newUnit) => {
      if (newUnit === mediaWidthUnit) return;

      const editorInnerWidth = getEditorInnerWidth();
      const currentVal = parseFloat(mediaWidthInput);
      if (isNaN(currentVal) || currentVal <= 0) {
        setMediaWidthUnit(newUnit);
        return;
      }

      let converted = currentVal;
      if (newUnit === "px" && mediaWidthUnit === "%") {
        converted = Math.round((editorInnerWidth * currentVal) / 100);
        applyMediaWidthPx(selectedMedia, converted);
      } else if (newUnit === "%" && mediaWidthUnit === "px") {
        converted = Math.min(
          100,
          Math.max(10, Math.round((currentVal / editorInnerWidth) * 100))
        );
        applyMediaWidthPercent(selectedMedia, converted);
      }

      setMediaWidthInput(String(converted));
      setMediaWidthUnit(newUnit);
      setSelectionVersion((v) => v + 1);
      triggerChange();
    };

    const handleAlignment = (align) => {
      selectedMedia.classList.remove("image-align-left", "image-align-center", "image-align-right");
      selectedMedia.classList.add(`image-align-${align}`);
      const img = selectedMedia.querySelector("img");
      if (img) img.setAttribute("data-align", align);
      triggerChange();
    };

    const setWidth = (percent) => {
      applyMediaWidthPercent(selectedMedia, percent);
      syncMediaWidthControls(selectedMedia);
      setSelectionVersion((v) => v + 1);
      triggerChange();
    };

    const removeMedia = () => {
      selectedMedia.remove();
      clearMediaSelection();
      triggerChange();
    };

    const isActivePercent = (percent) => {
      if (selectedMedia.dataset.widthPx) return false;
      if (!selectedMedia.dataset.widthPercent && !(selectedMedia.style.width || "").endsWith("%")) {
        return false;
      }
      return Math.abs(currentPercent - percent) <= 3;
    };

    const isFormControl = (target) =>
      target instanceof Element && !!target.closest("input, select, textarea");

    return (
      <div
        className="rte-media-toolbar"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!isFormControl(e.target)) {
            e.preventDefault();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: Math.max(4, toolbarTop),
          left: Math.max(
            8,
            Math.min(
              relLeft + mediaWidth / 2 - toolbarWidth / 2,
              anchorRect.width - toolbarWidth - 8
            )
          ),
          zIndex: 1000,
        }}
      >
        <button type="button" onClick={() => handleAlignment("left")} title="Align Left">L</button>
        <button type="button" onClick={() => handleAlignment("center")} title="Align Center">C</button>
        <button type="button" onClick={() => handleAlignment("right")} title="Align Right">R</button>
        <span className="rte-media-toolbar-divider" />
        {widthPresets.map((percent) => (
          <button
            key={percent}
            type="button"
            className={isActivePercent(percent) ? "active" : ""}
            onClick={() => setWidth(percent)}
            title={`${percent}% width`}
          >
            {percent}%
          </button>
        ))}
        <span className="rte-media-toolbar-divider" />
        <div className="rte-media-width-custom">
          <input
            type="number"
            className="rte-media-width-input"
            value={mediaWidthInput}
            min={mediaWidthUnit === "%" ? 10 : 20}
            max={mediaWidthUnit === "%" ? 100 : 2000}
            title="Custom width"
            onChange={(e) => setMediaWidthInput(e.target.value)}
            onBlur={(e) => {
              if (e.relatedTarget?.closest?.(".rte-media-width-custom")) return;
              applyCustomMediaWidth();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCustomMediaWidth();
              }
            }}
          />
          <select
            className="rte-media-width-unit"
            value={mediaWidthUnit}
            onChange={(e) => handleUnitChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <option value="%">%</option>
            <option value="px">px</option>
          </select>
          <button
            type="button"
            className="rte-media-width-apply"
            title="Apply size"
            onClick={applyCustomMediaWidth}
          >
            ✓
          </button>
        </div>
        <span className="rte-media-toolbar-divider" />
        <button type="button" onClick={removeMedia} className="danger" title="Remove">×</button>
      </div>
    );
  };

  if (isLoading) {
    return <Spinner />;
  }

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
          {!disabled && (
          <div className="rte-toolbar">
            {/* Bold */}
            <button
              type="button"
              title="Bold"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("bold");
              }}
              className={`rte-toolbar-button ${isBold ? "active" : ""}`}
            >
              <FaBold size={14} />
            </button>

            {/* Italic */}
            <button
              type="button"
              title="Italic"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("italic");
              }}
              className={`rte-toolbar-button ${isItalic ? "active" : ""}`}
            >
              <FaItalic size={14} />
            </button>

            {/* Underline */}
            <button
              type="button"
              title="Underline"
              onMouseDown={(e) => {
                e.preventDefault();
                exec("underline");
              }}
              className={`rte-toolbar-button ${isUnderline ? "active" : ""}`}
            >
              <FaUnderline size={14} />
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }}></div>

            {/* Headings */}
            <select
              value={currentBlockFormat}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyBlockFormat(e.target.value);
              }}
              className="rte-toolbar-select rte-heading-select"
              title="Text style"
            >
              <option value="div">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="blockquote">Quote</option>
            </select>

            <button
              type="button"
              title="Clear Formatting"
              className="rte-toolbar-button rte-toolbar-button-text"
              onMouseDown={(e) => {
                e.preventDefault();
                clearFormatting();
              }}
            >
              Tx
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
            <label title="Text Color" className="rte-color-picker-label">
              <FaFont size={14} style={{ color: fontColor }} />
              <input
                type="color"
                value={fontColor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  saveSelection();
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  applyTextColor(e.target.value);
                }}
                className="rte-color-input"
              />
            </label>

            {/* Background Color */}
            <label
              title={areaHighlightMode ? "Highlight color for area selection" : "Text background color"}
              className="rte-color-picker-label rte-bg-color-picker-label"
            >
              <span
                className="rte-bg-color-swatch"
                style={{ backgroundColor: bgColor, color: fontColor }}
              >
                A
              </span>
              <input
                type="color"
                value={bgColor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!areaHighlightMode) saveSelection();
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  const color = e.target.value;
                  setBgColor(color);
                  if (!areaHighlightMode) {
                    applyBackgroundColor(color);
                  }
                }}
                className="rte-color-input"
              />
            </label>

            <button
              type="button"
              title="Area highlight — drag to select a box (like screenshot)"
              className={`rte-toolbar-button rte-area-highlight-toggle${areaHighlightMode ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAreaHighlightMode((prev) => !prev);
                setMarqueePreview(null);
                areaDragRef.current = null;
                focus();
              }}
            >
              <span className="rte-area-highlight-icon" aria-hidden="true" />
            </button>

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
              <FaLink size={14} />
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
          )}
        {/* Editor Content Area */}
        <div
          ref={contentWrapperRef}
          className={`rte-content-wrapper${areaHighlightMode ? " rte-area-highlight-mode" : ""}`}
          style={{ position: 'relative' }}
          onMouseDown={handleAreaSelectMouseDown}
        >
          {areaHighlightMode && (
            <div className="rte-area-highlight-hint" aria-hidden="true">
              Drag to select an area, then release to apply highlight
            </div>
          )}
          {marqueePreview && (
            <div
              className="rte-marquee-preview"
              style={{
                left: marqueePreview.left,
                top: marqueePreview.top,
                width: marqueePreview.width,
                height: marqueePreview.height,
                backgroundColor: `${bgColor}55`,
                borderColor: bgColor,
              }}
            />
          )}
          <div
            ref={editorRef}
            contentEditable={editable && disabled !== true}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={label || "Rich text editor"}
            onInput={handleInput}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragStart={(e) => e.preventDefault()}
            onDragOver={(e) => e.preventDefault()}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onMouseUp={() => {
              saveSelection();
              setSelectionVersion((v) => v + 1);
            }}
            onClick={handleEditorClick}
            onFocus={handleEditorFocus}
            onBlur={handleEditorBlur}
            style={{
              minHeight: minHeight || '150px',
              maxHeight: maxHeight || '500px',
              paddingLeft: paddingLeft || '12px'
            }}
            className={`rte-content${editable ? " rte-is-editable" : ""}${editorFocused ? " rte-is-focused" : ""}`}
          />
          {isEmpty && editable && disabled !== true && (
            <div
              className="rte-placeholder"
              style={{ left: paddingLeft || '12px' }}
              aria-hidden="true"
            >
              {placeholder}
            </div>
          )}
          {renderMediaToolbar()}
        </div>

        
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
              <div className="rte-modal-header">
                <h3 className="rte-modal-title">Insert Link</h3>
              </div>
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
              <div className="rte-modal-actions">
                <button type="button" className="rte-button rte-button-secondary" onClick={cancelLink}>Cancel</button>
                <button type="button" className="rte-button rte-button-primary" onClick={confirmLink} disabled={!linkUrl}>Insert</button>
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
