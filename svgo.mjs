import { optimize, loadConfig } from "svgo";
import ignoreModule from "ignore";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";

const LOG_PREFIX = "SVGO:\t";
const IGNORE_FILE = ".svgo-ignore";

const ignore = ignoreModule();
try {
  await access(IGNORE_FILE);
  ignore.add(await readFile(IGNORE_FILE, "utf8"));
} catch {
  // Missing ignore file is fine; treat as no ignore rules.
}

const INPUT_DIR = "src";
const OUTPUT_DIR = "dist";
const sizeArg = getArgValue("--size");
const widthArg = getArgValue("--width");
const heightArg = getArgValue("--height");
const classArg = getArgValue("--class");
const canvasArg = getArgValue("--canvas");
const paddingArg = getArgValue("--padding");

if (canvasArg) process.env.SVGO_CANVAS_SIZE = canvasArg;
if (paddingArg) process.env.SVGO_CANVAS_PADDING = paddingArg;
const width = sizeArg || widthArg;
const height = sizeArg || heightArg;

const config = await loadConfig("svgo.config.js");

const files = await listFiles(INPUT_DIR);
const foundSvgFiles = files.filter((file) => file.endsWith(".svg"));
const svgFilesToProcess = foundSvgFiles.filter(
  (file) => !ignore.ignores(posixPath(relative(INPUT_DIR, file)))
);

console.log(
  LOG_PREFIX,
  `${foundSvgFiles.length - svgFilesToProcess.length} of ${
    foundSvgFiles.length
  } files ignored as of ${IGNORE_FILE}.`
);

await Promise.all(
  svgFilesToProcess.map(async (file) => {
    const svgString = await readFile(file, "utf8");
    const perFileConfig = classArg
      ? {
          ...config,
          plugins: config.plugins.map((plugin) =>
            plugin?.name === "addClassesToSVGElement"
              ? {
                  ...plugin,
                  params: {
                    ...plugin.params,
                    classNames: [classArg],
                  },
                }
              : plugin
          ),
        }
      : config;
    const { data } = optimize(svgString, {
      ...perFileConfig,
      path: file,
    });
    const outputSvg =
      width && height ? addDimensions(data, width, height) : data;

    const outputPath = join(OUTPUT_DIR, relative(INPUT_DIR, file));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, outputSvg, "utf8");
  })
);

await renameDistSvgs();
console.log(LOG_PREFIX, "Successful.\n");

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath);
      return fullPath;
    })
  );

  return files.flat();
}

function posixPath(filePath) {
  return filePath.split(sep).join("/");
}

function addDimensions(svg, widthValue, heightValue) {
  const match = svg.match(/<svg\b[^>]*>/i);
  if (!match) return svg;

  const originalTag = match[0];
  const strippedTag = originalTag.replace(
    /\s(?:width|height)="[^"]*"/gi,
    ""
  );
  const updatedTag = strippedTag.replace(
    />$/,
    ` width="${widthValue}" height="${heightValue}">`
  );

  return svg.replace(originalTag, updatedTag);
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function renameDistSvgs() {
  try {
    await access(OUTPUT_DIR);
  } catch {
    return;
  }

  const entries = await readdir(OUTPUT_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (extname(entry.name).toLowerCase() !== ".svg") continue;

    const src = join(OUTPUT_DIR, entry.name);
    const base = entry.name.slice(0, -extname(entry.name).length);
    const newBase = slugify(base);
    const newName = newBase + ".svg";
    if (newName === entry.name) continue;

    const uniqueName = await uniquePath(OUTPUT_DIR, newName);
    await rename(src, join(OUTPUT_DIR, uniqueName));
  }
}

function slugify(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const hyphenated = normalized
    .replace(/[\s_]+/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return hyphenated || "file";
}

async function uniquePath(dir, filename) {
  const base = filename.slice(0, -extname(filename).length);
  let candidate = filename;
  let i = 2;
  while (await pathExists(join(dir, candidate))) {
    candidate = `${base}-${i}.svg`;
    i += 1;
  }
  return candidate;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
