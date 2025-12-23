import { optimize, loadConfig } from "svgo";
import ignoreModule from "ignore";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

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
    const { data } = optimize(svgString, {
      ...config,
      path: file,
    });

    const outputPath = join(OUTPUT_DIR, relative(INPUT_DIR, file));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, data, "utf8");
  })
);

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
