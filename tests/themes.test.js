/* Themes are only safe if no colour escapes the palette. A single hardcoded
   hex left behind is a thing that stays dark when everything else goes light,
   and it won't show up until someone looks at that exact screen -- which is
   precisely what a test can catch and I cannot. */

module.exports = function (suite) {
  const harness = require("./harness");
  const app = harness.loadApp();
  const css = harness.readFile("style.css");
  // every script, not just app.js -- a stray colour hides just as well in any of them
  const js = harness.scriptFiles().map(harness.readFile).join("\n");

  /* The palette blocks are where literals are supposed to live, and they are
     no longer only the ones at the top of the file -- a theme token added
     later (the creator's cautionary yellow, which the palette had no
     equivalent of) is declared further down. So "palette" is every
     [data-theme=...] block anywhere in the file, not a fixed prefix of it. */
  const THEME_BLOCK = /(?::root,\s*)?\[data-theme="[a-z]+"\]\s*\{[^}]*\}/g;
  const paletteEnd = css.indexOf("* { box-sizing: border-box; }");
  const head = css.slice(0, paletteEnd);
  const tail = css.slice(paletteEnd);
  const palette = head + "\n" + (tail.match(THEME_BLOCK) || []).join("\n");
  const rules = tail.replace(THEME_BLOCK, "");

  suite.section("no colour escapes the palette");
  const strayCss = (rules.match(/#[0-9A-Fa-f]{3,8}\b/g) || []);
  suite.is("no hex literals in the rules", strayCss, []);
  const strayRgba = (rules.match(/rgba?\([^)]*\)/g) || []);
  suite.is("no rgb literals in the rules", strayRgba, []);
  const namedColours = (rules.match(/:\s*(black|white|red|green|blue|grey|gray)\b/g) || []);
  suite.is("no named colours in the rules", namedColours, []);
  const strayJs = (js.match(/#[0-9A-Fa-f]{6}\b/g) || []);
  suite.is("no hex literals in inline styles", strayJs, []);

  suite.section("every theme defines every variable");
  function variablesIn(block) {
    return new Set((block.match(/--[a-z-]+(?=\s*:)/g) || []));
  }
  // a theme's variables can now come from more than one block (see above), so
  // accumulate rather than overwrite
  const blocks = {};
  palette.replace(/(:root,\s*)?\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g, (all, root, name, body) => {
    const found = blocks[name] || new Set();
    variablesIn(body).forEach(variable => found.add(variable));
    blocks[name] = found;
    return all;
  });

  suite.ok("the three themes are all defined",
    Object.keys(blocks).sort().join(",") === "ember,fantasy,light",
    "found " + Object.keys(blocks).join(", "));

  const reference = blocks.ember;
  suite.ok("ember defines a full palette", reference && reference.size > 15, "only " + (reference ? reference.size : 0));
  Object.keys(blocks).forEach(name => {
    const missing = [...reference].filter(variable => !blocks[name].has(variable));
    suite.is(name + " defines every variable ember does", missing, []);
  });

  suite.section("every variable used is actually defined");
  const used = new Set((css + js).match(/var\((--[a-z-]+)/g) || []);
  const undefinedVars = [...used]
    .map(match => match.replace("var(", ""))
    .filter(variable => !reference.has(variable));
  suite.is("nothing references a variable that doesn't exist", undefinedVars, []);

  suite.section("themes are distinct");
  function valuesIn(name) {
    const match = palette.match(new RegExp('\\[data-theme="' + name + '"\\]\\s*\\{([^}]*)\\}'));
    return match ? match[1] : "";
  }
  suite.ok("fantasy is not a copy of ember", valuesIn("fantasy") !== valuesIn("ember"));
  suite.ok("light is not a copy of ember", valuesIn("light") !== valuesIn("ember"));

  suite.section("light really is lighter");
  function brightness(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114);
  }
  function colourOf(themeName, variable) {
    const block = valuesIn(themeName);
    const match = block.match(new RegExp(variable + ":\\s*(#[0-9A-Fa-f]{6})"));
    return match ? match[1] : null;
  }
  ["--page", "--surface", "--control"].forEach(variable => {
    const dark = brightness(colourOf("ember", variable));
    const light = brightness(colourOf("light", variable));
    suite.ok("light " + variable + " is brighter than ember's", light > dark,
      "ember " + dark.toFixed(0) + " vs light " + light.toFixed(0));
  });
  suite.ok("light text is darker than its surface",
    brightness(colourOf("light", "--text")) < brightness(colourOf("light", "--surface")));
  suite.ok("ember text is lighter than its surface",
    brightness(colourOf("ember", "--text")) < 255 &&
    brightness(colourOf("ember", "--text")) > brightness(colourOf("ember", "--surface")));

  suite.section("text stays readable on its background");
  function contrast(a, b) {
    const channel = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = hex => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
    };
    const one = lum(a), two = lum(b);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  }
  ["ember", "fantasy", "light"].forEach(name => {
    const ratio = contrast(colourOf(name, "--text"), colourOf(name, "--surface"));
    suite.ok(name + " body text clears 7:1 on a card", ratio >= 7, "ratio " + ratio.toFixed(1));
    const dim = contrast(colourOf(name, "--text-dim"), colourOf(name, "--surface"));
    suite.ok(name + " secondary text clears 4.5:1", dim >= 4.5, "ratio " + dim.toFixed(1));
    const onAccent = contrast(colourOf(name, "--accent-ink"), colourOf(name, "--accent"));
    suite.ok(name + " button text clears 4.5:1 on the accent", onAccent >= 4.5, "ratio " + onAccent.toFixed(1));
    /* the accent is also used AS text -- brand name, links, the active tab --
       so it has to be readable against a card, not just behind one */
    const accentAsText = contrast(colourOf(name, "--accent"), colourOf(name, "--surface"));
    suite.ok(name + " accent is readable as text on a card", accentAsText >= 4.5, "ratio " + accentAsText.toFixed(1));
    const softAsText = contrast(colourOf(name, "--accent-soft"), colourOf(name, "--surface"));
    suite.ok(name + " soft accent is readable as text", softAsText >= 4.5, "ratio " + softAsText.toFixed(1));
  });

  suite.section("switching themes");
  suite.is("starts on ember", app.theme.base, "ember");
  app.setTheme("light");
  suite.is("the base changes", app.theme.base, "light");
  app.setTheme("fantasy");
  suite.is("and again", app.theme.base, "fantasy");

  suite.section("custom overrides sit on top of a base");
  app.theme.custom["--accent"] = "#ff0000";
  app.applyTheme();
  suite.is("the base is untouched", app.theme.base, "fantasy");
  suite.is("the override is recorded", app.theme.custom["--accent"], "#ff0000");
  app.theme.custom = {};
  app.applyTheme();
  suite.is("clearing leaves the base alone", app.theme.base, "fantasy");
  suite.is("and no overrides", Object.keys(app.theme.custom).length, 0);

  suite.section("the choice persists separately from characters");
  app.setTheme("light");
  app.theme.custom["--accent"] = "#00ff00";
  app.persistTheme();
  suite.ok("written under its own key", !!app.localStorage.getItem("campfire.theme"));
  suite.ok("not mixed into the character save",
    !(app.localStorage.getItem("campfire.characters") || "").includes("campfire.theme"));

  app.theme = { base: "ember", custom: {} };
  app.loadTheme();
  suite.is("the base comes back", app.theme.base, "light");
  suite.is("and the overrides", app.theme.custom["--accent"], "#00ff00");

  app.localStorage.removeItem("campfire.theme");
  app.theme = { base: "fantasy", custom: {} };
  app.loadTheme();
  suite.is("an empty store falls back to the default", app.theme.base, "ember");

  app.localStorage.setItem("campfire.theme", "{ not json");
  suite.runs("a damaged store does not crash", () => app.loadTheme());

  suite.section("the picker");
  app.setTheme("ember");
  const before = app.__modals.length;
  app.openThemeModal();
  const html = app.__modals[before].html;
  suite.ok("offers every theme", app.THEMES.every(t => html.includes('data-theme-pick="' + t.value + '"')));
  suite.ok("previews each one with its own colours", (html.match(/class="theme-swatches" data-theme=/g) || []).length === 3);
  suite.ok("marks the current one", /theme-option active/.test(html));
  suite.ok("offers the adjustable colours", app.CUSTOM_SWATCHES.every(s => html.includes('data-swatch="' + s.variable + '"')));
  suite.ok("and a way back", /id="theme-reset"/.test(html));
};
