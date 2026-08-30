/* Regenerates sw.js's cache list from the <script> list in index.html.

   Run it after adding or removing a file:  node tools/build-sw.js

   The list has to be generated rather than maintained, for the same reason
   tests/harness.js reads index.html rather than keeping its own copy: a file
   that the page loads but the worker doesn't cache works perfectly until the
   phone loses signal, and then fails in a way nobody can reproduce at a desk.
   The `structure` suite fails if this hasn't been re-run. */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function assetList() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  return ["./", "index.html", "style.css", "manifest.json",
          "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png",
          "logo-mark.png", "favicon-64.png"].concat(scripts);
}

function write() {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const block = "const ASSETS = [\n  " + assetList().map(a => JSON.stringify(a)).join(",\n  ") + "\n];";
  const next = sw.replace(/const ASSETS = \[[\s\S]*?\];/, block);

  // a deploy is a new cache name -- the old one is dropped on activate, so
  // this is the entire update story
  const bumped = next.replace(/campfire-v(\d+)/, (_, n) => "campfire-v" + (parseInt(n) + 1));

  fs.writeFileSync(path.join(ROOT, "sw.js"), bumped);
  console.log("sw.js updated: " + assetList().length + " assets, cache " +
    (bumped.match(/campfire-v\d+/) || [])[0]);
}

module.exports = { assetList };
if (require.main === module) write();
