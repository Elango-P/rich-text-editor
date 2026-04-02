import { renderToString } from "react-dom/server";
import React from "react";
import * as FaIcons from "react-icons/fa";
import fs from "fs";

const iconsToExtract = [
  "FaImage",
  "FaArrowDown",
  "FaBold",
  "FaItalic",
  "FaUnderline",
  "FaTextHeight",
  "FaAlignCenter",
  "FaAlignRight",
  "FaAlignJustify",
  "FaAlignLeft",
  "FaListOl",
  "FaListUl",
  "FaFonticons",
  "FaFont",
  "FaLink",
];

let output = `import React from 'react';\n\n`;

for (const name of iconsToExtract) {
  const IconComponent = FaIcons[name];
  if (IconComponent) {
    const svgStr = renderToString(React.createElement(IconComponent));
    output += `export const ${name} = ({ className, size, color, style }) => {\n  return (\n    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size || '1em', color: color || 'inherit', ...style }} dangerouslySetInnerHTML={{ __html: \`${svgStr}\` }} />\n  );\n};\n\n`;
  }
}

fs.writeFileSync("src/icons.jsx", output);
