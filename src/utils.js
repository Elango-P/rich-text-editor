// Basic ID generator
export const getRandomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

// DraftJS helper stubs
// Since we are removing specific DraftJS dependencies for this package,
// these serve as placeholders or basic HTML verifiers.

export const isValidDraftFormat = (content) => {
  if (typeof content !== "object" || content === null) return false;
  return !!(content.blocks && content.entityMap);
};

// A very basic fallback. Ideally, the user should pass HTML strings.
// Dealing with full DraftJS->HTML conversion without the library is complex.
// We assume for this package that if the legacy DraftJS format is passed,
// the user might need to handle it or we expect HTML primarily.
export const draftBlocksToHTML = (content) => {
  console.warn(
    "draftBlocksToHTML: DraftJS object detected but full conversion is simplified in this package.",
  );
  // Return empty or try to extract text as a fallback
  if (content && content.blocks) {
    return content.blocks.map((b) => `<p>${b.text}</p>`).join("");
  }
  return "";
};
