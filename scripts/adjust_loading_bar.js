const fs = require('fs');

/**
 * Returns the GitHub contribution green shade corresponding to the overall progress percentage:
 *   - 0% to less than 25%: Shade 1 (var(--c1) - darkest green)
 *   - 25% to less than 50%: Shade 2 (var(--c2) - second green shade)
 *   - 50% to less than 75%: Shade 3 (var(--c3) - third green shade)
 *   - 75% to 100%: Shade 4 (var(--c4) - brightest green shade)
 */
function getShade(completedUnits, totalUnits) {
  const p = completedUnits / totalUnits;
  if (p < 0.25) return 'var(--c1)';
  if (p < 0.50) return 'var(--c2)';
  if (p < 0.75) return 'var(--c3)';
  return 'var(--c4)';
}

/**
 * Adjusts the Snake loading bar in the generated SVGs so that the entire filled portion
 * of the single loading bar transitions through the four GitHub contribution green shades
 * based on overall completion percentage:
 *   - At 10%: entirely Shade 1 (var(--c1))
 *   - At 30%: entirely Shade 2 (var(--c2))
 *   - At 60%: entirely Shade 3 (var(--c3))
 *   - At 80% & 100%: entirely Shade 4 (var(--c4))
 * Color transitions occur at exact 25%, 50%, and 75% thresholds.
 */
function adjustSvgLoadingBar(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Extract all eaten cell timestamps from @keyframes c...
  const cellRegex = /@keyframes c\w+\{([\d.]+)%\{fill:var\(--c\d\)\}([\d.]+)%,to\{fill:var\(--ce\)\}\}/g;
  const eatenTs = [];
  let match;
  while ((match = cellRegex.exec(content)) !== null) {
    eatenTs.push(parseFloat(match[1]));
  }

  if (eatenTs.length === 0) {
    console.warn(`No contribution cell keyframes found in ${filePath}`);
    return false;
  }

  eatenTs.sort((a, b) => a - b);
  const N = eatenTs.length;
  console.log(`Processing ${filePath}: ${N} eaten cells detected.`);

  const totalWidth = '848.0';
  const height = '12';
  const yPos = '144';

  // Build the keyframe points for the unified loading bar @keyframes u
  const kfPoints = ['0%{transform:scale(0,1);fill:var(--c1)}'];

  const firstT = eatenTs[0];
  if (firstT > 0.02) {
    kfPoints.push(`${(firstT - 0.01).toFixed(2)}%{transform:scale(0,1);fill:var(--c1)}`);
  }

  for (let k = 0; k < N; k++) {
    const t = eatenTs[k];
    const progressBefore = k / N;
    const progressAfter = (k + 1) / N;

    const colorBefore = getShade(k, N);
    const colorAfter = getShade(k + 1, N);

    const sBefore = progressBefore === 0 ? '0' : progressBefore.toFixed(3).replace(/\.?0+$/, '');
    const sAfter = progressAfter.toFixed(3).replace(/\.?0+$/, '');

    kfPoints.push(`${(t - 0.01).toFixed(2)}%{transform:scale(${sBefore},1);fill:${colorBefore}}`);
    kfPoints.push(`${(t + 0.01).toFixed(2)}%{transform:scale(${sAfter},1);fill:${colorAfter}}`);
  }

  kfPoints.push('to{transform:scale(1,1);fill:var(--c4)}');

  const newKeyframe = `@keyframes u{${kfPoints.join('')}}`;
  const newStyle = '.u{animation-name:u;transform-origin:0 0;fill:var(--c1)}';
  const newRect = `<rect class="u" height="${height}" width="${totalWidth}" x="0.0" y="${yPos}"/>`;

  // Remove existing loading bar keyframes, styles, and rects
  content = content.replace(/@keyframes u\w*\{[^}]+\}/g, '');
  content = content.replace(/\.u\.u\w*\{[^}]+\}/g, '');
  content = content.replace(/\.u\{animation-name:[^}]+\}/g, '');
  content = content.replace(/<rect class="u[^"]*"[^>]*\/>/g, '');

  // Insert updated keyframes and style before </style>
  const styleEnd = content.indexOf('</style>');
  if (styleEnd !== -1) {
    content = content.slice(0, styleEnd) + newKeyframe + newStyle + content.slice(styleEnd);
  }

  // Insert single unified loading bar rect before </svg>
  const svgEnd = content.lastIndexOf('</svg>');
  if (svgEnd !== -1) {
    content = content.slice(0, svgEnd) + newRect + content.slice(svgEnd);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated loading bar in ${filePath}`);
  return true;
}

// Process all files passed as command-line arguments
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: node adjust_loading_bar.js <file1.svg> [file2.svg ...]');
  process.exit(1);
}

for (const f of files) {
  adjustSvgLoadingBar(f);
}
