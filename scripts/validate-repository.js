import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const requiredFiles = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "public/icons/apple-touch-icon.png",
  "public/icons/favicon-32x32.png",
  "public/icons/maskable-512x512.png",
  "public/icons/og-image.png",
  "public/icons/web-app-manifest-192x192.png",
  "public/icons/web-app-manifest-512x512.png",
];
const errors = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(root, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

function pngSize(relativePath) {
  const buffer = readFileSync(resolve(root, relativePath));
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

for (const [relativePath, expected] of Object.entries({
  "public/icons/web-app-manifest-192x192.png": [192, 192],
  "public/icons/web-app-manifest-512x512.png": [512, 512],
  "public/icons/maskable-512x512.png": [512, 512],
  "public/icons/apple-touch-icon.png": [180, 180],
  "public/icons/og-image.png": [1200, 630],
})) {
  if (!existsSync(resolve(root, relativePath))) continue;
  const size = pngSize(relativePath);
  if (!size || size.width !== expected[0] || size.height !== expected[1]) {
    errors.push(
      `${relativePath} must be ${expected[0]}x${expected[1]} (found ${size?.width ?? "?"}x${size?.height ?? "?"}).`,
    );
  }
}

const markdownFiles = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
const localLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
for (const markdownFile of markdownFiles) {
  if (!existsSync(resolve(root, markdownFile))) continue;
  const markdown = readFileSync(resolve(root, markdownFile), "utf8");
  for (const match of markdown.matchAll(localLinkPattern)) {
    const target = match[1].split("#")[0].trim();
    if (!target || /^(?:https?:|mailto:|#)/.test(target) || target.includes("<")) {
      continue;
    }
    const resolved = resolve(root, markdownFile, "..", target);
    if (!existsSync(resolved)) {
      errors.push(`Broken local link in ${markdownFile}: ${target}`);
    }
  }
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (packageJson.license !== "MIT") {
  errors.push(`package.json license must be MIT, found ${packageJson.license}.`);
}
if (extname(packageJson.repository?.url ?? "") !== ".git") {
  errors.push("package.json repository URL must point to the Git repository.");
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Repository metadata, local links, and public assets are valid.");
}
