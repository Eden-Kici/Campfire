/* The icon set.

   Every icon is one string of SVG markup drawn on a 24x24 grid, with no
   colour of its own: iconSvg() wraps it in an <svg> that strokes with
   currentColor, so an icon takes the colour of whatever it sits in and every
   theme gets it for free. That is also why none of these carry fill -- a
   filled shape would ignore the theme and sit on the sheet as a dark blob.

   They were drawn for 18-24px, which is where nearly all of them live: next
   to an item name, in an attack row, on a tab. Anything that needed more
   detail than that to read was cut rather than shipped as a smudge.

   Nearly all of them are wrapped in a `<g transform>` they were not drawn
   with, put there by a fitting pass. Two things that pass does, and both had
   to be learned the hard way:

   It centres them on their WEIGHT, not their bounding box. Those are not the
   same point and the eye follows the weight. The sparkle is the clearest
   case: a big four-pointed star with a small one trailing off the corner. Its
   box centre sits between the two stars, so box-centring pushes the big star
   -- the part anyone actually sees -- off to one side. Sixty-six of these 121
   had their mass more than half a unit from their box centre, and a column of
   resources made every one of those visible at once. So the pass renders each
   icon, weighs the lit pixels, and lands most of the way toward that centre of
   mass. Not all the way: a pure centroid over-corrects for anything with a
   long thin tail.

   And it evens out their size, because a set where one drawing fills 14 units
   and its neighbour fills 11 reads as an uneven column however well each one
   is centred. The target is the set's OWN MEDIAN size, measured, not a number
   anybody picked -- an earlier version of this pass fitted to a chosen 17.2
   and quietly shrank 111 of the 121 icons by a tenth, which is what you get
   for making the spread go away without checking where the middle went.
   Normalising to the median moves the outliers in from both ends and leaves
   the middle exactly where it was. Where fitting means scaling, the group
   carries a compensating `stroke-width` -- scaling a stroked path scales its
   stroke too, and a heavier line is a worse inconsistency than the one being
   fixed.

   Adding one: draw it inside x,y = 2.5..21.5 on the same 24x24 grid, keep it
   to a handful of elements, put its name in an ICON_GROUPS list or the picker
   will never offer it, and re-run that pass -- an icon added by hand will sit
   at the wrong size and the wrong place next to the rest, and you will not see
   it until it is in a list beside forty others. */

const ICON_VIEWBOX = "0 0 24 24";

const ICONS = {
  "tab-combat": "<g transform=\"translate(-0.554 -0.06) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M20.5 3.5 19.5 7 11 15.5 8.5 13 17 4.5Z\"/><path d=\"M6 12.5 11.5 18\"/><path d=\"M8.5 16.5 5 20\"/><path d=\"M3.5 3.5 4.5 7l8.5 8.5 2.5-2.5L7 4.5Z\"/><path d=\"M18 12.5 12.5 18\"/><path d=\"M15.5 16.5 19 20\"/></g>",
  "tab-character": "<g transform=\"translate(-1.627 -1.735) scale(1.143)\" stroke-width=\"1.531\"><circle cx=\"12\" cy=\"8\" r=\"3.5\"/><path d=\"M4.5 20a7.5 7.5 0 0 1 15 0\"/></g>",
  "tab-spells": "<g transform=\"translate(-1.68 -0.741) scale(1.111)\" stroke-width=\"1.575\"><path d=\"M10 3.5c.9 3.6 2 4.7 5.5 5.6-3.5.9-4.6 2-5.5 5.6-.9-3.6-2-4.7-5.5-5.6 3.5-.9 4.6-2 5.5-5.6Z\"/><path d=\"M17.5 14c.45 1.8 1 2.35 2.75 2.8-1.75.45-2.3 1-2.75 2.8-.45-1.8-1-2.35-2.75-2.8 1.75-.45 2.3-1 2.75-2.8Z\"/></g>",
  "tab-inventory": "<g transform=\"translate(0.366 0.417) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.75 20.5 7v10L12 21.25 3.5 17V7Z\"/><path d=\"M3.5 7 12 11.5 20.5 7\"/><path d=\"M12 11.5v9.75\"/></g>",
  "tab-notes": "<g transform=\"translate(-0.33 0.202)\"><path d=\"M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-11Z\"/><path d=\"M6.5 3v18\"/><path d=\"M9.5 3v18\"/><path d=\"M12.5 8.5h4M12.5 12h4\"/></g>",
  "sword": "<g transform=\"translate(-0.389 -0.148) scale(1.039)\" stroke-width=\"1.684\"><path d=\"M12 2.8 L14.2 6.6 L14.2 14.6 L9.8 14.6 L9.8 6.6 Z\"/><path d=\"M7.2 14.8 L16.8 14.8\"/><path d=\"M12 14.8 L12 19.2\"/><path d=\"M10.3 20 L13.7 20\"/></g>",
  "greatsword": "<g transform=\"translate(0.366 0.015) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.5 L16 7.6 L16 15.4 L8 15.4 L8 7.6 Z\"/><path d=\"M4.6 13.6 L4.6 15.8 L19.4 15.8 L19.4 13.6\"/><path d=\"M12 15.8 L12 20.2\"/><path d=\"M10 21 L14 21\"/></g>",
  "dagger": "<g transform=\"translate(-1.068 0.021) scale(1.096)\" stroke-width=\"1.597\"><path d=\"M12 3 L16.4 6.6 L16.4 11.8 L7.6 11.8 L7.6 6.6 Z\"/><path d=\"M6 12 L18 12\"/><path d=\"M12 12 L12 18.4\"/><path d=\"M9.8 19.2 L14.2 19.2\"/></g>",
  "axe": "<g transform=\"translate(-1.059 -0.624) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M11.9 3.8 L18.8 6.5 C19.7 9.4 19.7 11.6 18.8 14.3 L11.9 17 C13.7 12.6 13.7 8.2 11.9 3.8 Z\"/><path d=\"M3.6 20.8 L13.8 8.8\"/></g>",
  "mace": "<g transform=\"translate(0.507 1.533) scale(0.964)\" stroke-width=\"1.816\"><circle cx=\"12\" cy=\"9\" r=\"3.4\"/><path d=\"M12 5.6 L12 2.5 M14.94 7.3 L17.63 5.75 M9.06 7.3 L6.37 5.75 M14.94 10.7 L17.63 12.25 M9.06 10.7 L6.37 12.25\"/><path d=\"M12 12.4 L12 21.3\"/></g>",
  "club": "<g transform=\"translate(-0.083 -1.524) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3.7 19.8 C8 15.4 10.8 11 13.5 5.2 C15.6 2.8 21 7.6 18.9 10 C14.2 13.4 9.8 17 5.5 21.4 Z\"/></g>",
  "spear": "<g transform=\"translate(0.507 1.392) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M12 2.4 C17.2 6.4 17.2 9.4 12 13.4 C6.8 9.4 6.8 6.4 12 2.4 Z\"/><path d=\"M12 13.4 L12 21.4\"/><path d=\"M10.2 14.6 L13.8 14.6\"/></g>",
  "scythe": "<g transform=\"translate(1.051 0.553) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M12.9 4 C6.8 2.9 2.6 7.4 2.6 14.2 C4.6 11 7.8 9.4 12.2 9.4 Z\"/><path d=\"M12.9 5 C14.6 10.6 16.4 16 18.6 21.2\"/><path d=\"M15.2 12.8 L18.7 11.4\"/></g>",
  "whip": "<g transform=\"translate(-1.29 -0.137) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3.2 20.8 L7 17.6\"/><path d=\"M7 17.6 C11.4 14.4 9.6 8 13.6 5.2 C17.4 3 21.2 6 20.2 9.8 C19.4 13 15.4 13.6 14.2 11 C13.4 9.2 15.2 7.6 17 8.6\"/></g>",
  "bow": "<g transform=\"translate(0.789 0.356) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M8.4 2.8 C20.4 7 20.4 17 8.4 21.2\"/><path d=\"M8.4 2.8 L4.4 12 L8.4 21.2\"/><path d=\"M4.4 12 L19.4 12 M19.4 12 L15.8 9.8 M19.4 12 L15.8 14.2\"/></g>",
  "unarmed": "<g transform=\"translate(-0.147 -1.466) scale(1.081)\" stroke-width=\"1.619\"><path d=\"M6.4 12.2 C6.4 7.5 9 4.6 12.4 4.6 C15.8 4.6 18.4 7.5 18.4 12.2 L18.4 15.8 C18.4 19.2 16.2 21.3 12.4 21.3 C8.6 21.3 6.4 19.2 6.4 15.8 Z\"/><path d=\"M9.6 5.7 L9.6 10.4 M12.4 4.7 L12.4 10.4 M15.2 5.7 L15.2 10.4\"/><path d=\"M6.5 11.6 C5 10.9 3.6 11.8 3.4 13.3 C3.2 15.1 4.6 16.5 6.6 16.3\"/></g>",
  "arrow": "<g transform=\"translate(-0.948 -0.495) scale(1.067)\" stroke-width=\"1.641\"><path d=\"M20.36 3.64 L14.42 4.74 L19.26 9.58 Z\"/><path d=\"M18.16 5.84 L3.64 20.36\"/><path d=\"M3.86 17.39 L6.61 20.25 M5.73 15.41 L8.59 18.27 M7.71 13.43 L10.57 16.29\"/></g>",
  "dart": "<g transform=\"translate(0.507 -0.603) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M12 2.6 L13.7 7.6 L10.3 7.6 Z\"/><path d=\"M12 7.6 L12 18.6\"/><path d=\"M12 13.8 L7.6 17.6 L7.6 21.2 L12 18.6 L16.4 21.2 L16.4 17.6 Z\"/></g>",
  "net": "<g transform=\"translate(0.644 0.314) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 3.4 L20.6 12 L12 20.6 L3.4 12 Z M6.3 14.3 L14.3 6.3 M9.7 17.7 L17.7 9.7 M6.3 9.7 L14.3 17.7 M9.7 6.3 L17.7 14.3\"/><circle cx=\"12\" cy=\"20.6\" r=\"0.9\"/><circle cx=\"3.4\" cy=\"12\" r=\"0.9\"/><circle cx=\"20.6\" cy=\"12\" r=\"0.9\"/></g>",
  "shield": "<g transform=\"translate(-0.551 -0.148) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M4 4.2 L20 4.2 C20 13 16.8 18.8 12 21.2 C7.2 18.8 4 13 4 4.2 Z\"/></g>",
  "helm": "<g transform=\"translate(0.223 -0.243) scale(0.988)\" stroke-width=\"1.772\"><path d=\"M5.6 11.5 C5.6 6.2 8.4 3 12 3 C15.6 3 18.4 6.2 18.4 11.5 L18.4 17 C18.4 19.6 15.6 21.2 12 21.2 C8.4 21.2 5.6 19.6 5.6 17 Z\"/><path d=\"M9.4 9.4 L14.6 9.4 A2 2 0 0 1 14.6 13.4 L9.4 13.4 A2 2 0 0 1 9.4 9.4 Z\"/><path d=\"M10 16 L10 19 M14 16 L14 19\"/></g>",
  "boots": "<g transform=\"translate(-1.18 -1.668) scale(1.067)\" stroke-width=\"1.641\"><path d=\"M7 3.5 L12.5 3.5 L12.5 13.5 C14.5 14 17 15 18.8 16.8 C19.8 17.8 20 19 19.8 20.3 L7 20.3 Z\"/><path d=\"M7 6.6 L12.5 6.6\"/><path d=\"M7 17.8 L19.4 17.8\"/></g>",
  "cloak": "<g transform=\"translate(-0.499 -1.621) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M5 8.4 C6.4 5.6 8.6 4.2 10.6 4.2 C10.6 6.2 13.4 6.2 13.4 4.2 C15.4 4.2 17.6 5.6 19 8.4 L20.4 19.2 C17.4 21 14.8 21.4 12 21.4 C9.2 21.4 6.6 21 3.6 19.2 Z\"/><circle cx=\"12\" cy=\"8.6\" r=\"1.4\"/><path d=\"M9.4 11.2 L7.4 20.4 M14.6 11.2 L16.6 20.4\"/></g>",
  "rapier": "<g transform=\"translate(0.366 -0.686) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.5v11.5\"/><path d=\"M8.5 14.2c0 2.1 1.6 3.3 3.5 3.3s3.5-1.2 3.5-3.3\"/><path d=\"M12 17.5v3\"/><path d=\"M10 21h4\"/></g>",
  "quarterstaff": "<g transform=\"translate(-2.028 -2.03) scale(1.176)\" stroke-width=\"1.488\"><path d=\"M4.5 19.5 19.5 4.5\"/><path d=\"M5.5 16 8 18.5\"/><path d=\"M16 5.5 18.5 8\"/></g>",
  "caltrops": "<g transform=\"translate(-0.388 -0.785) scale(1.039)\" stroke-width=\"1.684\"><path d=\"M12 11.5 12 4\"/><path d=\"M12 11.5 5.5 18\"/><path d=\"M12 11.5 18.5 18\"/><circle cx=\"12\" cy=\"3.4\" r=\"1\"/><circle cx=\"4.7\" cy=\"18.8\" r=\"1\"/><circle cx=\"19.3\" cy=\"18.8\" r=\"1\"/></g>",
  "warhammer": "<g transform=\"translate(1.089 0.79) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M4.5 5.5 9 3l3 5.2-4.5 2.6Z\"/><path d=\"M9 10 17 20.5\"/><path d=\"M12.8 14.5l3.5-2\"/></g>",
  "sparkle": "<g transform=\"translate(0.648 0.647) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 2.6 C12.6 8.3 15.7 11.4 21.4 12 C15.7 12.6 12.6 15.7 12 21.4 C11.4 15.7 8.3 12.6 2.6 12 C8.3 11.4 11.4 8.3 12 2.6 Z\"/></g>",
  "wand": "<g transform=\"translate(-0.728 0.547)\"><path d=\"M3.4 20.6 L14 10\"/><path d=\"M17.9 3.5 C18.3 5.8 19.2 6.7 21.3 7.1 C19.2 7.5 18.3 8.4 17.9 10.7 C17.5 8.4 16.6 7.5 14.5 7.1 C16.6 6.7 17.5 5.8 17.9 3.5 Z\"/><path d=\"M8.4 12 L11.4 15\"/></g>",
  "orb": "<g transform=\"translate(0.366 -0.406) scale(0.976)\" stroke-width=\"1.794\"><circle cx=\"12\" cy=\"9.6\" r=\"6.8\"/><path d=\"M6.6 21.2 L8.4 18.6 L15.6 18.6 L17.4 21.2 Z\"/></g>",
  "rune": "<g transform=\"translate(0.076 0.206)\"><rect x=\"5.4\" y=\"2.9\" width=\"13.2\" height=\"18.2\" rx=\"2.2\"/><path d=\"M12 5.4 L12 18.6\"/><path d=\"M12 10.4 L15.6 6.8 M12 14.6 L8.4 11\"/></g>",
  "spellbook": "<g transform=\"translate(0.248 0.101)\"><rect x=\"4.3\" y=\"2.9\" width=\"15.4\" height=\"18.2\" rx=\"2.2\"/><path d=\"M7.9 2.9 L7.9 21.1\"/><path d=\"M14 8 C14.3 10.5 15.3 11.5 17.8 11.8 C15.3 12.1 14.3 13.1 14 15.6 C13.7 13.1 12.7 12.1 10.2 11.8 C12.7 11.5 13.7 10.5 14 8 Z\"/></g>",
  "crystal": "<g transform=\"translate(0.506 0.093) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M12 2.6 L17.3 8.6 L15.5 21.2 L8.5 21.2 L6.7 8.6 Z\"/><path d=\"M6.7 8.6 L12 11.6 L17.3 8.6\"/><path d=\"M12 11.6 L12 21.2\"/></g>",
  "pentacle": "<g transform=\"translate(0.367 0.36) scale(0.976)\" stroke-width=\"1.794\"><circle cx=\"12\" cy=\"12\" r=\"9.3\"/><path d=\"M12 2.7 L17.47 19.52 L3.15 9.13 L20.85 9.13 L6.53 19.52 Z\"/></g>",
  "portal": "<g transform=\"translate(-0.021 0.171) scale(0.976)\" stroke-width=\"1.794\"><circle cx=\"12\" cy=\"12\" r=\"9.3\"/><path d=\"M12 5.4 A6.6 6.6 0 0 1 18.6 12 A6.6 6.6 0 0 1 12 18.6 A3.6 3.6 0 0 1 8.4 15 A3.6 3.6 0 0 1 12 11.4\"/></g>",
  "hourglass": "<path d=\"M7.2 3 L16.8 3\"/><path d=\"M7.2 21 L16.8 21\"/><path d=\"M8.9 3 C8.9 8 12 10.4 12 12 C12 13.6 8.9 16 8.9 21\"/><path d=\"M15.1 3 C15.1 8 12 10.4 12 12 C12 13.6 15.1 16 15.1 21\"/>",
  "third-eye": "<g transform=\"translate(0.555 0.522) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M2.6 12 C5.1 7 8.5 4.8 12 4.8 C15.5 4.8 18.9 7 21.4 12 C18.9 17 15.5 19.2 12 19.2 C8.5 19.2 5.1 17 2.6 12 Z\"/><circle cx=\"12\" cy=\"12\" r=\"3.3\"/></g>",
  "talisman": "<g transform=\"translate(-0.229 -1.479) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M4.2 3.6 C4.8 10.2 7.7 13.4 12 13.4 C16.3 13.4 19.2 10.2 19.8 3.6\"/><circle cx=\"12\" cy=\"17.1\" r=\"4.3\"/><circle cx=\"12\" cy=\"17.1\" r=\"1.5\"/></g>",
  "flame": "<g transform=\"translate(0.183 -0.476) scale(0.988)\" stroke-width=\"1.772\"><path d=\"M12 2.6 C12 7 6 9.2 6 14.8 A6 6 0 0 0 18 14.8 C18 10 14.6 8.4 12 2.6 Z\"/><path d=\"M12 18.2 C10.4 18.2 9.4 17 9.4 15.7 C9.4 13.6 11.6 12.5 11.9 10.8 C13.2 12.4 14.6 13.4 14.6 15.7 C14.6 17 13.6 18.2 12 18.2 Z\"/></g>",
  "water": "<g transform=\"translate(0.366 -0.158) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.7 C12 2.7 5.5 10.1 5.5 14.8 A6.5 6.5 0 0 0 18.5 14.8 C18.5 10.1 12 2.7 12 2.7 Z\"/></g>",
  "frost": "<path d=\"M12 3 L12 21 M4.2 7.5 L19.8 16.5 M4.2 16.5 L19.8 7.5\"/><path d=\"M9.95 5.05 L12 3 L14.05 5.05 M9.95 18.95 L12 21 L14.05 18.95 M19.05 13.7 L19.8 16.5 L17 17.25 M4.95 13.7 L4.2 16.5 L7 17.25 M4.95 10.3 L4.2 7.5 L7 6.75 M19.05 10.3 L19.8 7.5 L17 6.75\"/>",
  "lightning": "<g transform=\"translate(0.6 0.663) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M13.8 2.5 L5 14 L12 14 L10.8 21.5 L19 10 L12 10 Z\"/></g>",
  "wind": "<g transform=\"translate(0.354 -0.351) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3 8 L12.5 8 A2.6 2.6 0 1 0 9.9 5.4\"/><path d=\"M3 12.4 L17 12.4 A3 3 0 1 1 14 15.6\"/><path d=\"M3 16.8 L10.5 16.8 A2.5 2.5 0 1 0 8 19.5\"/></g>",
  "earth": "<g transform=\"translate(0.236 -1.782) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M2.7 16.6 L4.8 10.8 L9.6 6.9 L15.4 7.6 L20.4 12.2 L21.2 17.4 L18.4 20.4 L5.4 20.4 Z\"/><path d=\"M9.6 6.9 L12.6 13.2 L21.2 17.4 M12.6 13.2 L6.4 20.4\"/></g>",
  "poison": "<g transform=\"translate(0.214 -1.032) scale(0.988)\" stroke-width=\"1.772\"><path d=\"M9.5 2.9 L9.5 9 L4.9 19.1 A2.1 2.1 0 0 0 6.8 21.2 L17.2 21.2 A2.1 2.1 0 0 0 19.1 19.1 L14.5 9 L14.5 2.9 Z\"/><circle cx=\"10.4\" cy=\"15\" r=\"1.6\"/><circle cx=\"14.1\" cy=\"17.9\" r=\"1.3\"/></g>",
  "acid": "<g transform=\"translate(0.366 -0.352) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 3 C12 3 7.8 8.2 7.8 11 A4.2 4.2 0 0 0 16.2 11 C16.2 8.2 12 3 12 3 Z\"/><path d=\"M2.7 17.2 L7.8 17.2 C8.5 21.4 15.5 21.4 16.2 17.2 L21.3 17.2\"/><path d=\"M5.6 13.4 L4.3 15.4 M18.4 13.4 L19.7 15.4\"/></g>",
  "radiant": "<g transform=\"translate(0.367 0.368) scale(0.976)\" stroke-width=\"1.794\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M18.5 12 L21.3 12 M16.6 16.6 L18.6 18.6 M12 18.5 L12 21.3 M7.4 16.6 L5.4 18.6 M5.5 12 L2.7 12 M7.4 7.4 L5.4 5.4 M12 5.5 L12 2.7 M16.6 7.4 L18.6 5.4\"/></g>",
  "necrotic": "<g transform=\"translate(0.367 0.121) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.6 C7 2.6 3.6 6.2 3.6 10.6 C3.6 13.4 5 15.4 6.8 16.7 L6.8 19.4 A1.8 1.8 0 0 0 8.6 21.2 L15.4 21.2 A1.8 1.8 0 0 0 17.2 19.4 L17.2 16.7 C19 15.4 20.4 13.4 20.4 10.6 C20.4 6.2 17 2.6 12 2.6 Z\"/><circle cx=\"8.9\" cy=\"10.4\" r=\"2\"/><circle cx=\"15.1\" cy=\"10.4\" r=\"2\"/><path d=\"M6.8 17 L17.2 17\"/><path d=\"M9.8 17 L9.8 21.2 M14.2 17 L14.2 21.2\"/></g>",
  "thunder": "<g transform=\"translate(0.644 0.643) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 2.6 L13.76 7.75 L18.65 5.35 L16.25 10.24 L21.4 12 L16.25 13.76 L18.65 18.65 L13.76 16.25 L12 21.4 L10.24 16.25 L5.35 18.65 L7.75 13.76 L2.6 12 L7.75 10.24 L5.35 5.35 L10.24 7.75 Z\"/></g>",
  "force": "<circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M15.54 7.79 A5.5 5.5 0 0 1 15.54 16.21 M18.36 5.64 A9 9 0 0 1 18.36 18.36\"/><path d=\"M8.46 7.79 A5.5 5.5 0 0 0 8.46 16.21 M5.64 5.64 A9 9 0 0 0 5.64 18.36\"/>",
  "heart": "<g transform=\"translate(0.643 1.36) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 21 L4.6 13.7 C3.2 12.3 2.5 10.6 2.5 8.8 A5.4 5.4 0 0 1 7.9 3.4 C9.6 3.4 10.8 3.9 12 5.3 C13.2 3.9 14.4 3.4 16.1 3.4 A5.4 5.4 0 0 1 21.5 8.8 C21.5 10.6 20.8 12.3 19.4 13.7 Z\"/></g>",
  "healing-cross": "<path d=\"M9.5 3 L14.5 3 L14.5 9.5 L21 9.5 L21 14.5 L14.5 14.5 L14.5 21 L9.5 21 L9.5 14.5 L3 14.5 L3 9.5 L9.5 9.5 Z\"/>",
  "blood": "<g transform=\"translate(-0.323 -0.135)\"><path d=\"M9.4 6 C9.4 6 4 12.4 4 16 A5.4 5.4 0 0 0 14.8 16 C14.8 12.4 9.4 6 9.4 6 Z\"/><path d=\"M18 3.2 C18 3.2 15.2 6.8 15.2 8.9 A2.8 2.8 0 0 0 20.8 8.9 C20.8 6.8 18 3.2 18 3.2 Z\"/></g>",
  "revive": "<g transform=\"translate(0.626 1.247) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M9.8 20.9 L4.2 15.4 C3.2 14.3 2.6 13 2.6 11.7 A4.1 4.1 0 0 1 6.7 7.6 C8 7.6 8.9 8 9.8 9 C10.7 8 11.6 7.6 12.9 7.6 A4.1 4.1 0 0 1 17 11.7 C17 13 16.4 14.3 15.4 15.4 Z\"/><path d=\"M18.4 2.6 C18.7 4.5 19.5 5.3 21.4 5.6 C19.5 5.9 18.7 6.7 18.4 8.6 C18.1 6.7 17.3 5.9 15.4 5.6 C17.3 5.3 18.1 4.5 18.4 2.6 Z\"/></g>",
  "scroll": "<g transform=\"translate(-2.548 -2.384) scale(1.22)\" stroke-width=\"1.434\"><path d=\"M5.5 5.5h13\"/><path d=\"M7 5.5v11.8c0 1 .8 1.9 1.8 2 1.4.2 2.2-.7 3.2-.7s1.8.9 3.2.7c1-.1 1.8-1 1.8-2V5.5\"/><path d=\"M9.5 9h5M9.5 12.5h5\"/></g>",
  "staff": "<g transform=\"translate(-1.884 1.144)\"><path d=\"M11 21.5 13 8.5\"/><path d=\"M9 8.5c0-3 2-5 4.8-5 2.4 0 4.2 1.6 4.2 3.7\"/><circle cx=\"17.2\" cy=\"9.2\" r=\"2\"/></g>",
  "rope": "<g transform=\"translate(-0.161 -0.929) scale(1.013)\" stroke-width=\"1.728\"><ellipse cx=\"11.6\" cy=\"12.4\" rx=\"8.6\" ry=\"7.2\"/><ellipse cx=\"11.6\" cy=\"12.4\" rx=\"5.6\" ry=\"4.6\"/><ellipse cx=\"11.6\" cy=\"12.4\" rx=\"2.6\" ry=\"2\"/><path d=\"M20.2 12.4 C21.6 15.6 20.6 19 18 20.4\"/></g>",
  "torch": "<g transform=\"translate(0.507 0.146) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M12 2.6 C15.4 5.6 16.4 7.6 16.4 9.4 C16.4 11.8 14.4 13.2 12 13.2 C9.6 13.2 7.6 11.8 7.6 9.4 C7.6 7.6 8.6 5.6 12 2.6 Z\"/><path d=\"M10 12.8 L10 21.2 L14 21.2 L14 12.8\"/><path d=\"M9.8 15.8 L14.2 15.8 M9.8 18.2 L14.2 18.2\"/></g>",
  "lantern": "<g transform=\"translate(-0.552 -0.669) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M9.2 5.2 C9.2 2.4 14.8 2.4 14.8 5.2\"/><path d=\"M6.4 7.8 L17.6 7.8 L15.6 5.2 L8.4 5.2 Z\"/><path d=\"M8 7.8 L16 7.8 L16 17.8 L8 17.8 Z\"/><path d=\"M6.4 20.4 L17.6 20.4 L16 17.8 L8 17.8 Z\"/><path d=\"M12 11.4 C13.2 12.6 13.4 13 13.4 13.6 C13.4 14.6 12.8 15.2 12 15.2 C11.2 15.2 10.6 14.6 10.6 13.6 C10.6 13 10.8 12.6 12 11.4 Z\"/></g>",
  "candle": "<g transform=\"translate(-0.552 -2.699) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M12 4.2 C13.8 6 14.2 6.8 14.2 7.8 C14.2 9.2 13.2 10 12 10 C10.8 10 9.8 9.2 9.8 7.8 C9.8 6.8 10.2 6 12 4.2 Z\"/><path d=\"M9 10.6 L15 10.6 L15 19.2 L9 19.2 Z\"/><path d=\"M6.4 19.2 L17.6 19.2 L17.6 21.2 L6.4 21.2 Z\"/></g>",
  "tent": "<g transform=\"translate(0.365 -0.933) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 3 L21.2 20.4 L2.8 20.4 Z\"/><path d=\"M8.6 20.4 C9.8 15.4 10.8 12 12 8.8 C13.2 12 14.2 15.4 15.4 20.4\"/></g>",
  "grappling-hook": "<g transform=\"translate(-0.23 -0.593) scale(1.026)\" stroke-width=\"1.706\"><circle cx=\"12\" cy=\"4.6\" r=\"2\"/><path d=\"M12 6.6 L12 14.2\"/><path d=\"M12 14.2 C12 18.8 8.8 20.8 5 20 M12 14.2 C12 18.8 15.2 20.8 19 20\"/></g>",
  "spyglass": "<g transform=\"translate(-1.478 -0.696) scale(1.096)\" stroke-width=\"1.597\"><path d=\"M4.4 17.4 L16.4 3.4 L20.6 7.6 L6.6 19.6 Z\"/><path d=\"M10.4 10.4 L13.6 13.6\"/><path d=\"M7.4 13.9 L10.1 16.6\"/></g>",
  "compass": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M16 8 L13.4 13.4 L8 16 L10.6 10.6 Z\"/>",
  "map": "<g transform=\"translate(0.417 0.389) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M2.8 6.6 L9 4.2 L15 6.6 L21.2 4.2 L21.2 17.4 L15 19.8 L9 17.4 L2.8 19.8 Z\"/><path d=\"M9 4.2 L9 17.4 M15 6.6 L15 19.8\"/><path d=\"M5.6 16.4 C7.6 12.6 10.4 14.4 11.8 11 C13 8.2 15.6 7.4 18 8.6\"/></g>",
  "hourglass-sand": "<g transform=\"translate(0.076 -0.371)\"><path d=\"M6 3 L18 3 M6 21 L18 21\"/><path d=\"M7.6 3 C7.6 8.4 12 10.6 12 12 C12 13.4 7.6 15.6 7.6 21 M16.4 3 C16.4 8.4 12 10.6 12 12 C12 13.4 16.4 15.6 16.4 21\"/><path d=\"M9.4 21 C10 17.6 14 17.6 14.6 21\"/><path d=\"M12 13.6 L12 16.4\"/></g>",
  "bell": "<g transform=\"translate(0.224 -0.468) scale(0.988)\" stroke-width=\"1.772\"><path d=\"M6 17.6 C7.6 15.6 8 13.4 8 10.8 C8 7.2 9.8 4.6 12 4.6 C14.2 4.6 16 7.2 16 10.8 C16 13.4 16.4 15.6 18 17.6 Z\"/><path d=\"M12 4.6 L12 2.8\"/><path d=\"M10 19.4 C10 21.6 14 21.6 14 19.4\"/></g>",
  "pickaxe": "<g transform=\"translate(0.076 0.781)\"><path d=\"M3 9.8 C7 4.2 17 4.2 21 9.8\"/><path d=\"M12 5.6 L12 21.2\"/><path d=\"M9.8 6.2 L14.2 6.2 L14 9.6 L10 9.6 Z\"/></g>",
  "saw": "<g transform=\"translate(0.577 0.325) scale(0.988)\" stroke-width=\"1.772\"><path d=\"M7.8 8.8 L20.8 8.8 L20.8 12.6 L18.6 14.8 L16.4 12.6 L14.2 14.8 L12 12.6 L9.8 14.8 L7.8 12.6 Z\"/><path d=\"M7.6 8.8 C4 8.8 2.6 10.2 2.6 12.2 C2.6 14.2 4 15.6 6 15.6 L7.6 13.4\"/></g>",
  "fishing-rod": "<g transform=\"translate(-1.363 -1.952) scale(1.081)\" stroke-width=\"1.619\"><path d=\"M3.4 20.6 C8 16 13.4 9.4 19.4 4.6\"/><circle cx=\"7\" cy=\"16.6\" r=\"1.8\"/><path d=\"M19.4 4.6 C20.4 8.6 19.6 11.6 18.4 14\"/><path d=\"M18.4 14 L18.4 16.4 C18.4 18.6 15.6 18.6 15.6 16.6\"/></g>",
  "lockpick": "<g transform=\"translate(-0.084 -2.922) scale(1.039)\" stroke-width=\"1.684\"><path d=\"M3.2 19.1 L6.6 15.7 L8.3 17.4 L4.9 20.8 Z\"/><path d=\"M7.4 16.6 L17 7 C18.2 5.8 20 6.2 20.4 8\"/><path d=\"M8.6 21.2 L15.6 14.2 L18.6 17.2\"/></g>",
  "key": "<g transform=\"translate(1.012 -0.422) scale(1.026)\" stroke-width=\"1.706\"><circle cx=\"6.8\" cy=\"12\" r=\"3.8\"/><circle cx=\"6.8\" cy=\"12\" r=\"1.5\"/><path d=\"M10.6 12 L20.6 12\"/><path d=\"M16.6 12 L16.6 15.6 M19.6 12 L19.6 15\"/></g>",
  "chain": "<g transform=\"translate(0.368 0.372) scale(0.976)\" stroke-width=\"1.794\"><rect x=\"5.6\" y=\"2.8\" width=\"7\" height=\"9.6\" rx=\"3.5\"/><rect x=\"11.4\" y=\"11.6\" width=\"7\" height=\"9.6\" rx=\"3.5\"/></g>",
  "manacles": "<g transform=\"translate(0.645 -2.02) scale(0.952)\" stroke-width=\"1.838\"><circle cx=\"6.9\" cy=\"15.4\" r=\"4.3\"/><circle cx=\"17.1\" cy=\"15.4\" r=\"4.3\"/><path d=\"M9.6 12.2 C10.6 9.8 11.4 9.4 12 9.4 C12.6 9.4 13.4 9.8 14.4 12.2\"/></g>",
  "backpack": "<g transform=\"translate(-0.23 -1.162) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M5.4 10 C5.4 7.6 7.2 6.2 9.4 6.2 L14.6 6.2 C16.8 6.2 18.6 7.6 18.6 10 L18.6 18.8 C18.6 20.4 17.6 21.3 16 21.3 L8 21.3 C6.4 21.3 5.4 20.4 5.4 18.8 Z\"/><path d=\"M9.6 6.2 C9.6 3 14.4 3 14.4 6.2\"/><path d=\"M5.5 13 L18.5 13\"/><path d=\"M10.4 13 L13.6 13 L13.6 15.6 L10.4 15.6 Z\"/></g>",
  "pouch": "<g transform=\"translate(-2.028 -3.921) scale(1.176)\" stroke-width=\"1.488\"><path d=\"M8.4 10.6 C9.6 8.4 14.4 8.4 15.6 10.6\"/><path d=\"M8.4 10.6 C4.6 13 4.6 21.2 12 21.2 C19.4 21.2 19.4 13 15.6 10.6\"/><path d=\"M7.8 12.8 C9.8 14 14.2 14 16.2 12.8\"/><path d=\"M9.4 9 C7.8 7.4 6.6 6.6 5.4 6.2 M14.6 9 C16.2 7.4 17.4 6.6 18.6 6.2\"/></g>",
  "chest": "<g transform=\"translate(-0.552 -2.054) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3.4 10.6 C3.4 4.6 20.6 4.6 20.6 10.6 Z\"/><path d=\"M3.4 10.6 L20.6 10.6 L20.6 19.4 C20.6 20.6 19.8 21.2 18.6 21.2 L5.4 21.2 C4.2 21.2 3.4 20.6 3.4 19.4 Z\"/><path d=\"M10.4 8.8 L13.6 8.8 L13.6 14 L10.4 14 Z\"/></g>",
  "barrel": "<g transform=\"translate(-0.552 -0.551) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M7.6 3.4 C4.6 8.4 4.6 15.6 7.6 20.6 L16.4 20.6 C19.4 15.6 19.4 8.4 16.4 3.4 Z\"/><path d=\"M5.4 8.4 L18.6 8.4 M5.4 15.6 L18.6 15.6\"/><path d=\"M12 3.4 L12 20.6\"/></g>",
  "sack": "<g transform=\"translate(0.076 0.341)\"><path d=\"M7.4 3.2 C9.6 5 9.6 6.6 9.4 8 C5.6 10.4 3.6 21.2 12 21.2 C20.4 21.2 18.4 10.4 14.6 8 C14.4 6.6 14.4 5 16.6 3.2 Z\"/><path d=\"M9 8.2 C10.4 9.2 13.6 9.2 15 8.2\"/></g>",
  "quiver": "<g transform=\"translate(0.58 0.567) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M7.8 9 L7.8 18.2 C7.8 20.4 9.6 21.4 11.8 21.4 C14 21.4 15.8 20.4 15.8 18.2 L15.8 9\"/><ellipse cx=\"11.8\" cy=\"9\" rx=\"4\" ry=\"1.6\"/><path d=\"M9.6 8.4 L8 3 M11.8 8 L11.8 2.8 M14 8.4 L15.6 3\"/><path d=\"M7.8 11.4 L15.8 15.4\"/></g>",
  "bag-large": "<g transform=\"translate(-0.55 -1.04) scale(1.053)\" stroke-width=\"1.663\"><ellipse cx=\"12\" cy=\"8.8\" rx=\"8.6\" ry=\"2.4\"/><path d=\"M3.4 8.8 L5.2 18.8 C5.5 20.4 6.6 21.2 8.2 21.2 L15.8 21.2 C17.4 21.2 18.5 20.4 18.8 18.8 L20.6 8.8\"/><path d=\"M8.4 7.4 C8.8 3.4 15.2 3.4 15.6 7.4\"/></g>",
  "crate": "<g transform=\"translate(-0.552 -0.682) scale(1.053)\" stroke-width=\"1.663\"><rect x=\"3.4\" y=\"4.6\" width=\"17.2\" height=\"15\" rx=\"1\"/><path d=\"M3.4 8.6 L20.6 8.6 M3.4 15.6 L20.6 15.6\"/><path d=\"M3.4 15.6 L20.6 8.6\"/></g>",
  "tinderbox": "<g transform=\"translate(0.298 -0.637) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M4.5 12.5h11a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 18.5V14a1.5 1.5 0 0 1 1.5-1.5Z\"/><path d=\"M3 15.5h14\"/><path d=\"M18.5 3.5c.5 2 1 2.5 3 3-2 .5-2.5 1-3 3-.5-2-1-2.5-3-3 2-.5 2.5-1 3-3Z\"/></g>",
  "bedroll": "<path d=\"M8 7.5h9a4.5 4.5 0 0 1 0 9H8Z\"/><circle cx=\"8\" cy=\"12\" r=\"4.5\"/><circle cx=\"8\" cy=\"12\" r=\"1.6\"/><path d=\"M14 7.5v9\"/>",
  "mirror": "<g transform=\"translate(0.136 0.91)\"><ellipse cx=\"12\" cy=\"9\" rx=\"5.5\" ry=\"6.5\"/><path d=\"M12 15.5v4.5\"/><path d=\"M9.5 20.5h5\"/><path d=\"M9.8 7 11.4 8.6\"/></g>",
  "shovel": "<g transform=\"translate(-0.551 -0.475) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M12 3.5v10\"/><path d=\"M9.3 3.5h5.4\"/><path d=\"M8.5 13h7L12 20.5Z\"/></g>",
  "bread": "<g transform=\"translate(-1.918 -2.18) scale(1.176)\" stroke-width=\"1.488\"><path d=\"M4.5 12c0-3.6 3.3-6.5 7.5-6.5s7.5 2.9 7.5 6.5v4.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z\"/><path d=\"M8.3 8.6 10 11.2\"/><path d=\"M12 7.8 13.7 10.4\"/></g>",
  "cheese": "<g transform=\"translate(-0.842 -2.003) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3.5 15.5 12 7.5l8.5 3.5v6.5h-17Z\"/><circle cx=\"8\" cy=\"14\" r=\"1.1\"/><circle cx=\"15\" cy=\"14.5\" r=\"1.1\"/></g>",
  "apple": "<g transform=\"translate(0.479 0.386) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 8.5c-3.5-2.5-8 .5-8 5 0 3.5 3 8 5.5 8 1.2 0 1.8-.6 2.5-.6s1.3.6 2.5.6c2.5 0 5.5-4.5 5.5-8 0-4.5-4.5-7.5-8-5Z\"/><path d=\"M12 8.5V5.5\"/><path d=\"M12 5.5c2.5 0 3.5-1.5 3.5-3-2 0-3.5 1-3.5 3Z\"/></g>",
  "waterskin": "<g transform=\"translate(-0.891 -1.832) scale(1.081)\" stroke-width=\"1.619\"><path d=\"M9 4.5h6v2.5a7 7 0 0 1 3 5.7v4.8a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 6 17.5v-4.8A7 7 0 0 1 9 7Z\"/><path d=\"M6.2 12.5h11.6\"/></g>",
  "tankard": "<g transform=\"translate(-1.603 -2.023) scale(1.111)\" stroke-width=\"1.575\"><path d=\"M5.5 6.5h10v13a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5Z\"/><path d=\"M15.5 9.5h1.8a3 3 0 0 1 0 6h-1.8\"/><path d=\"M5.5 6.5c1.5-2 8.5-2 10 0\"/></g>",
  "bottle": "<g transform=\"translate(-0.23 -1.051) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M10 3.5h4v3.8l2.3 3.4a4 4 0 0 1 .7 2.3v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6a4 4 0 0 1 .7-2.3L10 7.3Z\"/><path d=\"M7.3 14.5h9.4\"/></g>",
  "herb": "<g transform=\"translate(-0.415 0.415) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M12 21V9\"/><path d=\"M12 13c-4.5 0-6.5-2.5-6.5-6 3.5-.5 6.5 1.5 6.5 6Z\"/><path d=\"M12 10.5c0-4 2.5-6.5 6-6.5.5 3.5-1.5 6.5-6 6.5Z\"/></g>",
  "mushroom": "<g transform=\"translate(-0.552 0.275) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M3.5 11.5c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5Z\"/><path d=\"M9.5 11.5v5.5a2.5 2.5 0 0 0 5 0v-5.5\"/></g>",
  "paw": "<g transform=\"translate(-1.825 -1.602) scale(1.159)\" stroke-width=\"1.509\"><ellipse cx=\"7\" cy=\"9\" rx=\"2.1\" ry=\"2.7\"/><ellipse cx=\"12\" cy=\"7.2\" rx=\"2.1\" ry=\"2.8\"/><ellipse cx=\"17\" cy=\"9\" rx=\"2.1\" ry=\"2.7\"/><path d=\"M12 12c3.3 0 5.5 2.2 5.5 4.6 0 2.2-1.8 3.6-3.6 3-1.3-.4-2.5-.4-3.8 0-1.8.6-3.6-.8-3.6-3C6.5 14.2 8.7 12 12 12Z\"/></g>",
  "feather": "<g transform=\"translate(-1.128 -1.418) scale(1.111)\" stroke-width=\"1.575\"><path d=\"M18.5 4.5c-8 0-11 4.5-11 9.5 0 1.4.3 2.6.8 3.6C13 17 18.5 13.5 18.5 4.5Z\"/><path d=\"M5 20.5 12 13\"/></g>",
  "fang": "<g transform=\"translate(-1.949 -1.598) scale(1.176)\" stroke-width=\"1.488\"><path d=\"M6.5 4.5h11c0 6.5-2 10.5-3.5 15-1-3-1.5-6-1.5-9.5-1.5 3-2.5 6-3 9.5-1.8-4.5-3-8.5-3-15Z\"/></g>",
  "tree": "<g transform=\"translate(0.356 1.404) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 21v-6\"/><path d=\"M12 15c-4 0-6.5-2.6-6.5-6 0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5c0 3.4-2.5 6-6.5 6Z\"/><path d=\"M12 15 9 12\"/><path d=\"M12 12.5 15 9.5\"/></g>",
  "leaf": "<g transform=\"translate(-2.142 -1.289) scale(1.143)\" stroke-width=\"1.531\"><path d=\"M20 4c-10 0-15 4-15 10.5 0 2.6 1.4 4.4 3.5 5C17 19.5 20 12 20 4Z\"/><path d=\"M15.5 8.5 7 17.5\"/></g>",
  "spider": "<g transform=\"translate(-1.249 -1.206) scale(1.111)\" stroke-width=\"1.575\"><ellipse cx=\"12\" cy=\"13\" rx=\"3.5\" ry=\"4.5\"/><circle cx=\"12\" cy=\"7\" r=\"2\"/><path d=\"M8.6 10.5 4.5 8M8.5 13H4M8.6 15.5 5 18.5\"/><path d=\"M15.4 10.5 19.5 8M15.5 13H20M15.4 15.5 19 18.5\"/></g>",
  "fish": "<g transform=\"translate(-1.768 -1.512) scale(1.143)\" stroke-width=\"1.531\"><path d=\"M16 12c0 3.5-3.6 6.5-8 6.5-1.2 0-2.4-.2-3.4-.6C5.4 16.6 6 14.4 6 12s-.6-4.6-1.4-5.9c1-.4 2.2-.6 3.4-.6 4.4 0 8 3 8 6.5Z\"/><path d=\"M16 12l4-4v8Z\"/><circle cx=\"9\" cy=\"10\" r=\".9\"/></g>",
  "bone": "<g transform=\"translate(-0.888 2.294) scale(1.081)\" stroke-width=\"1.619\"><path d=\"M8.5 12.5 15.5 5.5\"/><path d=\"M8.5 12.5a2.6 2.6 0 1 0-3.6 3.6 2.6 2.6 0 1 0 3.6-3.6Z\"/><path d=\"M15.5 5.5a2.6 2.6 0 1 1 3.6-3.6 2.6 2.6 0 1 1-3.6 3.6Z\"/></g>",
  "hand": "<g transform=\"translate(-0.557 -0.385) scale(1.039)\" stroke-width=\"1.684\"><path d=\"M8.5 12V6a1.6 1.6 0 0 1 3.2 0v4.5\"/><path d=\"M11.7 10V5.2a1.6 1.6 0 0 1 3.2 0V11\"/><path d=\"M14.9 11V7.6a1.6 1.6 0 0 1 3.1 0V15c0 3.6-2.6 6-6 6s-6-2.4-6-6v-3.4a1.6 1.6 0 0 1 3.1 0\"/></g>",
  "sleep": "<g transform=\"translate(-1.274 -2.223) scale(1.22)\" stroke-width=\"1.434\"><path d=\"M4.5 5.5h6L4.5 12h6\"/><path d=\"M12.5 12.5h5l-5 5.5h5\"/></g>",
  "d20": "<g transform=\"translate(0.643 0.643) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9Z\"/><path d=\"M12 2.5 7 12l5 9.5\"/><path d=\"M12 2.5 17 12l-5 9.5\"/><path d=\"M3.5 7.5 7 12l-3.5 4.5\"/><path d=\"M20.5 7.5 17 12l3.5 4.5\"/><path d=\"M7 12h10\"/></g>",
  "d6": "<g transform=\"translate(0.366 0.588) scale(0.976)\" stroke-width=\"1.794\"><path d=\"M12 2.75 20.5 7v10L12 21.25 3.5 17V7Z\"/><path d=\"M3.5 7 12 11.5 20.5 7\"/><path d=\"M12 11.5v9.75\"/><circle cx=\"12\" cy=\"7.2\" r=\".9\"/></g>",
  "target": "<g transform=\"translate(-0.551 -0.562) scale(1.053)\" stroke-width=\"1.663\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4.5\"/><circle cx=\"12\" cy=\"12\" r=\".9\"/></g>",
  "flag": "<g transform=\"translate(0.816 0.933) scale(1.026)\" stroke-width=\"1.706\"><path d=\"M6 21V3.5\"/><path d=\"M6 4.5h11.5l-2.5 4 2.5 4H6Z\"/></g>",
  "music": "<g transform=\"translate(-1.006 -1.038) scale(1.067)\" stroke-width=\"1.641\"><path d=\"M9 18V5.5l10-2V16\"/><ellipse cx=\"6.5\" cy=\"18.2\" rx=\"2.6\" ry=\"2.2\"/><ellipse cx=\"16.5\" cy=\"16.2\" rx=\"2.6\" ry=\"2.2\"/></g>",
  "scales": "<g transform=\"translate(1.4 1.36) scale(0.889)\" stroke-width=\"1.969\"><path d=\"M12 3.5v17\"/><path d=\"M7 20.5h10\"/><path d=\"M4 7.5h16\"/><path d=\"M4 7.5 1.8 13.5h4.4Z\"/><path d=\"M20 7.5 17.8 13.5h4.4Z\"/></g>",
  "star": "<g transform=\"translate(0.645 0.087) scale(0.952)\" stroke-width=\"1.838\"><path d=\"M12 3 14.8 9.2 21.5 10 16.6 14.5 18 21 12 17.7 6 21l1.4-6.5L2.5 10l6.7-.8Z\"/></g>",
  "moon": "<g transform=\"translate(0.921 -1.7) scale(1.039)\" stroke-width=\"1.684\"><path d=\"M20 14.5A8.7 8.7 0 0 1 9.5 4 8.7 8.7 0 1 0 20 14.5Z\"/></g>",
  "lock": "<g transform=\"translate(-0.552 -1.258) scale(1.053)\" stroke-width=\"1.663\"><rect x=\"4.5\" y=\"10\" width=\"15\" height=\"10.5\" rx=\"2\"/><path d=\"M8 10V7.5a4 4 0 0 1 8 0V10\"/><circle cx=\"12\" cy=\"15.2\" r=\"1.3\"/></g>",
  "clock": "<g transform=\"translate(-0.643 -0.473) scale(1.053)\" stroke-width=\"1.663\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7v5.2l3.4 2.2\"/></g>",
  "speech": "<g transform=\"translate(0.021 0.224) scale(1.053)\" stroke-width=\"1.663\"><path d=\"M4.5 6a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 6v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 5V15.4A2.5 2.5 0 0 1 4.5 13Z\"/></g>",
  "flower": "<circle cx=\"12\" cy=\"12\" r=\"2.4\"/><circle cx=\"12\" cy=\"6.2\" r=\"3.2\"/><circle cx=\"12\" cy=\"17.8\" r=\"3.2\"/><circle cx=\"6.2\" cy=\"12\" r=\"3.2\"/><circle cx=\"17.8\" cy=\"12\" r=\"3.2\"/>",
  "bird": "<g transform=\"translate(-1.262 -1.474) scale(1.081)\" stroke-width=\"1.619\"><path d=\"M15.5 5.5a4 4 0 0 0-4 4c0 3-2 4-4 4-2 0-4-1-4-1 0 4.5 3.5 8 8 8 4.5 0 8-3.5 8-8V7\"/><path d=\"M15.5 5.5 19.5 4l-1.5 3.5\"/><path d=\"M14.5 8h.01\"/></g>",
  "footprint": "<g transform=\"translate(1.944 1.815) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M8.5 21c-2.4 0-4-1.6-4-3.7 0-2.4 1.6-3.4 1.6-5.6C6.1 9.2 7 7.5 9.4 7.5c2.4 0 3.6 1.9 3.6 4.4 0 2.4-.9 3.6-.9 5.6 0 2.1-1.2 3.5-3.6 3.5Z\"/><circle cx=\"6.4\" cy=\"4.6\" r=\"1.5\"/><circle cx=\"10.4\" cy=\"3.6\" r=\"1.5\"/><circle cx=\"14\" cy=\"5\" r=\"1.4\"/><circle cx=\"16.2\" cy=\"8\" r=\"1.3\"/></g>",
  "cog": "<g transform=\"translate(0.367 0.375) scale(0.976)\" stroke-width=\"1.794\"><circle cx=\"12\" cy=\"12\" r=\"6.5\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/><path d=\"M12 2.8v3.2M12 18v3.2M21.2 12H18M6 12H2.8M18.5 5.5l-2.3 2.3M7.8 16.2l-2.3 2.3M18.5 18.5l-2.3-2.3M7.8 7.8 5.5 5.5\"/></g>",
  "snake": "<g transform=\"translate(2.128 1.846) scale(0.964)\" stroke-width=\"1.816\"><path d=\"M4.5 20c4.5 0 4.5-4.6 0-4.6s-4.5-4.6 0-4.6c3.5 0 5.5-1.8 5.5-4.4\"/><path d=\"M10 6.4a3.4 3.4 0 1 1 6.8 0c0 2.4-2 3.4-4 3.4\"/><path d=\"M16.8 5.2 20 4M16.8 5.2 20 6.6\"/></g>",
  "heart-beat": "<g transform=\"translate(-0.541 2.372) scale(0.92)\" stroke-width=\"1.903\"><path d=\"M10.5 19.5 4.8 13.8C3.7 12.7 3.2 11.3 3.2 9.9A4.35 4.35 0 0 1 7.55 5.55c1.35 0 2.35.4 3.2 1.5.85-1.1 1.85-1.5 3.2-1.5A4.35 4.35 0 0 1 17.3 9.9c0 1.4-.5 2.8-1.6 3.9Z\"/><path d=\"M18.6 4.4a5.5 5.5 0 0 1 0 7.8\"/><path d=\"M21.2 2.4a8.6 8.6 0 0 1 0 11.8\"/></g>",
};

/* The picker's own order. A flat list of 120 names is a wall; these groups are
   how somebody looking for "something that means poison" actually finds it.
   Every icon has to appear in exactly one group -- the structure suite checks
   both directions, because an icon missing from here is an icon nobody can
   ever choose. */
const ICON_GROUPS = [
  { name: "Weapons", icons: ["sword", "greatsword", "dagger", "rapier", "axe", "mace", "warhammer", "club", "quarterstaff", "spear", "scythe", "whip", "bow", "unarmed"] },
  { name: "Ammunition", icons: ["arrow", "dart", "net", "caltrops", "quiver"] },
  { name: "Armour", icons: ["shield", "helm", "boots", "cloak"] },
  { name: "Magic", icons: ["sparkle", "wand", "staff", "orb", "rune", "scroll", "spellbook", "crystal", "pentacle", "portal", "hourglass", "third-eye", "talisman"] },
  { name: "Damage", icons: ["flame", "water", "frost", "lightning", "wind", "earth", "poison", "acid", "radiant", "necrotic", "thunder", "force"] },
  { name: "Life", icons: ["heart", "heart-beat", "healing-cross", "blood", "revive", "bone", "hand", "footprint", "sleep", "fang", "paw", "feather"] },
  { name: "Kit", icons: ["rope", "torch", "lantern", "candle", "tinderbox", "bedroll", "tent", "grappling-hook", "spyglass", "compass", "map", "mirror", "bell", "hourglass-sand"] },
  { name: "Tools", icons: ["pickaxe", "shovel", "saw", "fishing-rod", "lockpick", "key", "chain", "manacles"] },
  { name: "Containers", icons: ["backpack", "pouch", "sack", "bag-large", "chest", "crate", "barrel"] },
  { name: "Food", icons: ["bread", "cheese", "apple", "mushroom", "herb", "waterskin", "tankard", "bottle"] },
  { name: "Nature", icons: ["tree", "leaf", "flower", "spider", "snake", "fish", "bird"] },
  { name: "Marks", icons: ["star", "moon", "d20", "d6", "target", "flag", "music", "scales", "cog", "lock", "clock", "speech"] }
];

/* One <svg> shape for every icon on the sheet. `currentColor` is the whole
   trick: the icon inherits the colour of the row it sits in, so a dimmed row
   dims its icon and a theme change needs no icon work at all.

   aria-hidden because every icon in this app sits next to its own name. An
   icon that announced "sword" after the row already said "Longsword" would
   read the name twice to anyone using a screen reader. */
function iconSvg(name, opts) {
  const markup = ICONS[name];
  if (!markup) return "";
  const { className, size } = opts || {};
  return `<svg class="ico${className ? " " + className : ""}" viewBox="${ICON_VIEWBOX}"`
    + (size ? ` style="width:${size}px;height:${size}px;"` : "")
    + ` fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"`
    + ` stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
}

/* What a thing looks like is worked out from its name unless somebody has
   said otherwise -- the same rule source tags follow. That is what makes the
   whole sheet iconed on the first run instead of only after you have been
   round every row picking one, and it keeps a renamed item honest: call a
   Longsword a Torch and it becomes a torch.

   Order matters. The list is read top to bottom and the first hit wins, so
   the specific words sit above the general ones: "greatsword" has to be
   checked before "sword", or every greatsword in the game is a longsword. */
const ICON_KEYWORDS = [
  // weapons first: a Flame Tongue is a sword before it is a fire
  [/great ?sword|claymore|zweih/i, "greatsword"],
  [/great ?axe|battle ?axe|hand ?axe|\baxe\b|hatchet/i, "axe"],
  [/war ?hammer|\bmaul\b|\bhammer\b/i, "warhammer"],
  [/morningstar|\bmace\b|\bflail\b/i, "mace"],
  [/rapier|scimitar|short ?sword/i, "rapier"],
  [/sword|\bblade\b|katana|falchion/i, "sword"],
  [/dagger|\bknife|stiletto|\bshiv\b/i, "dagger"],
  [/\bclub\b|cudgel|baton/i, "club"],
  [/quarterstaff|\bpole\b|walking stick/i, "quarterstaff"],
  [/\bstaff\b|\brod\b|sceptre|scepter/i, "staff"],
  [/spear|\bpike\b|javelin|trident|glaive|halberd|lance/i, "spear"],
  [/scythe|sickle/i, "scythe"],
  [/\bwhip|\blash\b/i, "whip"],
  [/crossbow bolt/i, "arrow"],
  [/\bbow\b|longbow|shortbow|crossbow|\bsling\b/i, "bow"],
  [/unarmed|\bfist|punch|brawl|\bmonk\b/i, "unarmed"],

  // then what a thing is made of, so "Fire Bolt" is a fire and not a bolt
  [/\bfire\b|flame|\bburn|blaze|ember|pyro|ignite/i, "flame"],
  [/\bcold\b|\bice\b|frost|freez|\bchill|\bsnow|winter/i, "frost"],
  [/lightning|\bshock\b|electric|\bstorm/i, "lightning"],
  [/thunder|\bsonic\b|\bsound\b|shout|\bboom/i, "thunder"],
  [/\bacid\b|corrod|dissolv/i, "acid"],
  [/radiant|\bholy\b|divine|divinit|\bsun\b|\blight\b|bless|sacred/i, "radiant"],
  [/necrot|\bdeath\b|undead|\bskull|wither|\bdecay|\bcurse|\bgrave\b/i, "necrotic"],
  [/\bforce\b|missile|\bshove\b|\bpush\b|repel/i, "force"],
  [/\bwind\b|\bgust\b|\bair\b|\bgale\b|\bfog\b|\bcloud|\bmist\b/i, "wind"],
  [/\bwater\b|\bwave\b|\btide\b|\baqua|\bsea\b|\brain\b/i, "water"],
  [/\bearth|\brock\b|boulder|\bmud\b|\bsand\b|\bore\b|ingot|\bmetal\b/i, "earth"],

  // healing above poison, so a Potion of Healing is not a flask of venom
  [/\bheal|\bcure\b|\bmend\b|restor|medicine|bandage|herbalism/i, "healing-cross"],
  [/revive|revivif|raise dead|resurrect|spare the dying/i, "revive"],
  [/\bblood|bleed|\bwound|haemo|\bhemo/i, "blood"],
  [/surge|adrenalin|\bfury\b|\bhaste\b|\bburst\b|pound/i, "heart-beat"],
  [/\bheart\b|vitality|hit point|\bhp\b|\blife\b/i, "heart"],

  [/\barrow|\bbolt\b|ammunition|\bammo\b/i, "arrow"],
  [/\bdart\b|shuriken|throwing star|needle/i, "dart"],
  [/\bnet\b|\bsnare\b|\bweb\b/i, "net"],
  [/caltrop|\bspike|ball bearing/i, "caltrops"],
  [/quiver|bolt case/i, "quiver"],

  [/shield|buckler|\bward\b/i, "shield"],
  [/\bhelm|\bhat\b|\bcap\b|crown|circlet|\bhood\b/i, "helm"],
  [/\bboot|\bshoe|greave|slipper|sandal/i, "boots"],
  [/cloak|\bcape\b|mantle|\brobe|\bvest|armou?r|\bmail\b|\bplate\b|leather|\bshirt\b|tunic|cuirass|brigandine|padded|studded|\bhide\b|\bscale\b|splint/i, "cloak"],

  [/\bwand\b/i, "wand"],
  [/\borb\b|sphere|crystal ball/i, "orb"],
  [/\brune|\bsigil|\bglyph/i, "rune"],
  [/scroll|parchment|\bdeed\b|contract/i, "scroll"],
  [/spell ?book|grimoire|\btome\b|\bbook\b|manual|codex/i, "spellbook"],
  [/crystal|\bgem\b|jewel|diamond|ruby|sapphire|emerald|shard/i, "crystal"],
  [/pentacle|pentagram|holy symbol|\bsymbol\b|\bidol\b/i, "pentacle"],
  [/portal|\bgate\b|teleport|\brift\b|dimension/i, "portal"],
  [/third eye|\beye\b|\bsight|see ?invis|detect|vision|clairvoy|\bscry/i, "third-eye"],
  [/amulet|talisman|necklace|pendant|\bcharm\b|brooch|\bring\b/i, "talisman"],
  [/arcane|\bmagic\b|\bcantrip|enchant|\bsorcer|\bwizard/i, "sparkle"],

  [/poison|venom|toxin|potion|elixir|antitoxin|\bflask\b|\bvial\b|\boil\b/i, "poison"],

  [/\bbone\b|skelet/i, "bone"],
  [/\bhand\b|grasp|\bgrip\b|\btouch\b/i, "hand"],
  [/\bfoot|\btrack\b|\bstep\b|stride|\bspeed\b|\bmove/i, "footprint"],
  [/sleep|slumber|\bdream|\brest\b|drows/i, "sleep"],
  [/\bfang\b|\bbite\b|\btooth|\bteeth|\bclaw\b|talon/i, "fang"],
  [/\bpaw\b|\bbeast|\banimal|\bwolf\b|\bbear\b|\bcat\b|\bdog\b|hound/i, "paw"],
  [/feather|quill|plume|\bwing\b|\bfly\b|flight/i, "feather"],

  [/\brope\b|\bcord\b|twine|cable|hempen/i, "rope"],
  [/torch/i, "torch"],
  [/lantern|\blamp\b/i, "lantern"],
  [/candle/i, "candle"],
  [/tinderbox|\bflint\b|steel and/i, "tinderbox"],
  [/bedroll|blanket|sleeping bag/i, "bedroll"],
  [/\btent\b|shelter|pavilion/i, "tent"],
  [/grappl|\bhook\b|piton|climb/i, "grappling-hook"],
  [/spyglass|telescope|\blens\b|magnif/i, "spyglass"],
  [/compass|navigat|bearing/i, "compass"],
  [/\bmap\b|\bchart\b|cartog/i, "map"],
  [/mirror|polished steel|reflect/i, "mirror"],
  [/\bbell\b|chime|\bgong\b/i, "bell"],
  [/hourglass|sandglass/i, "hourglass-sand"],

  [/\bpick\b|pickaxe|mining/i, "pickaxe"],
  [/shovel|\bspade\b|\bdig\b/i, "shovel"],
  [/\bsaw\b|carpent|woodcarv/i, "saw"],
  [/fishing|tackle|hook and line/i, "fishing-rod"],
  [/thieves|lockpick|pick.?lock|burglar/i, "lockpick"],
  [/\bkey\b|keyring/i, "key"],
  [/\bchain\b|\blink\b/i, "chain"],
  [/manacle|shackle|handcuff|\bbind\b|restrain/i, "manacles"],

  [/backpack|rucksack|\bpack\b/i, "backpack"],
  [/pouch|\bpurse\b|\bkit\b|supplies|utensil/i, "pouch"],
  [/\bsack\b/i, "sack"],
  [/\bbag\b|haversack|satchel/i, "bag-large"],
  [/\bchest\b|coffer|strongbox|treasure/i, "chest"],
  [/\bcrate\b|\bbox\b|\bcase\b/i, "crate"],
  [/barrel|\bcask\b|\bkeg\b|\btun\b/i, "barrel"],

  [/bread|\bloaf\b|\brations?\b|hardtack|flour/i, "bread"],
  [/cheese/i, "cheese"],
  [/apple|\bfruit\b|berry|berries/i, "apple"],
  [/mushroom|fungus|fungi|truffle/i, "mushroom"],
  [/\bherb\b|\bplant\b|\bseed\b|sprig|sprout|\bmoss\b/i, "herb"],
  [/waterskin|canteen|flagon/i, "waterskin"],
  [/\bale\b|tankard|\bbeer\b|\bmug\b|stein|\bmead\b/i, "tankard"],
  [/\bwine\b|bottle|\bjug\b|spirits/i, "bottle"],

  [/\btree\b|\bwood\b|forest|\boak\b|timber/i, "tree"],
  [/\bleaf\b|leaves|druid|nature|entangle/i, "leaf"],
  [/flower|\bbloom\b|petal|\brose\b/i, "flower"],
  [/spider|insect|\bswarm\b|vermin|\bbug\b/i, "spider"],
  [/\bsnake\b|serpent|viper|\bnaga\b|cobra/i, "snake"],
  [/\bfish\b|shark|ocean/i, "fish"],
  [/\bbird\b|raven|\bcrow\b|\bowl\b|hawk|eagle|familiar/i, "bird"],

  [/\bstar\b|celestial|night sky/i, "star"],
  [/\bmoon\b|lunar|moonbeam/i, "moon"],
  [/\bd20\b|\bdice\b|\bdie\b|gaming set/i, "d20"],
  [/\bd6\b|\bcube\b/i, "d6"],
  [/target|\baim\b|\bmark\b|bullseye/i, "target"],
  [/banner|\bflag\b|standard|rally/i, "flag"],
  [/music|\bsong\b|instrument|\blute\b|flute|\bbard\b|\bhorn\b|\bdrum\b/i, "music"],
  [/scales|balance|\bjudg|justice|merchant/i, "scales"],
  [/\bcog\b|\bgear\b|mechanism|tinker|clockwork|construct/i, "cog"],
  [/\block\b|padlock|\bseal\b|warded/i, "lock"],
  [/\bclock\b|\bwatch\b|\bhour\b|minute/i, "clock"],
  [/speech|\bspeak\b|tongue|comprehend|message|command|whisper/i, "speech"],
  [/weapon|\battack\b|\bstrike\b/i, "sword"]
];

/* Fallbacks when nothing in the name matches -- one per kind of thing, so a
   row is never iconless. Better a generic box than a gap where every other
   row has a mark. */
const ICON_FALLBACKS = {
  weapon: "sword", armor: "shield", spell: "sparkle", resource: "d6",
  effect: "sparkle", note: "scroll", coin: "pouch", item: "crate"
};

function guessIcon(name, kind) {
  const text = String(name || "");
  for (let i = 0; i < ICON_KEYWORDS.length; i++) {
    if (ICON_KEYWORDS[i][0].test(text)) return ICON_KEYWORDS[i][1];
  }
  return ICON_FALLBACKS[kind] || ICON_FALLBACKS.item;
}

/* The one question the rest of the app asks: what does this thing look like?
   A stored `icon` wins, a name-guess covers everything else, and a stored
   name that no longer exists in the set falls back rather than rendering
   nothing -- an icon can be retired without emptying every sheet that chose it. */
function iconFor(thing, kind) {
  if (thing && thing.icon && ICONS[thing.icon]) return thing.icon;
  return guessIcon(thing && thing.name, kind);
}

function iconHtml(thing, kind, opts) {
  return iconSvg(iconFor(thing, kind), opts);
}

/* ---------- choosing one ---------- */

/* The picker is a grid of every icon, grouped, with a search box over it. It
   is deliberately not a dropdown: 115 options in a select is a list nobody
   reads to the end of, and the whole point of an icon is that you recognise
   it faster than you read its name.

   "Automatic" is the first option and it is not an icon -- it clears the
   stored one and hands the row back to guessIcon(), which is what nearly
   every row wants. Picking is for the exceptions. */
let iconPickerState = null;

/* Its own overlay rather than openModal, for the same reason confirmModal has
   one: the picker is nearly always opened from inside a half-filled form, and
   openModal would replace that form and throw the typing away. This layers on
   top and leaves what is underneath alone. */
function openIconPickerModal(current, onPick, opts) {
  closeIconPicker();
  iconPickerState = { current: current || "", query: "", onPick: onPick,
                      name: (opts || {}).name || "", kind: (opts || {}).kind };
  const overlay = document.createElement("div");
  overlay.id = "icon-overlay";
  overlay.className = "icon-overlay";
  overlay.innerHTML = `<div class="icon-sheet"><div id="icon-picker-body"></div></div>`;
  document.querySelector(".phone").appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeIconPicker(); });
  redrawIconPicker();
}

function closeIconPicker() {
  const existing = document.getElementById("icon-overlay");
  if (existing) existing.remove();
  iconPickerState = null;
}

function redrawIconPicker() {
  const body = document.getElementById("icon-picker-body");
  if (!body) return;
  body.innerHTML = iconPickerHtml();
  wireIconPicker();
}

/* Search runs over the keyword table as well as the names, so the word people
   actually type finds the icon they actually mean: "fire" finds flame, "armor"
   finds cloak, "potion" finds the flask. Matching names alone made the search
   a spelling test for a vocabulary only this file knows. */
function iconSearchHits(query) {
  const hits = {};
  ICON_KEYWORDS.forEach(entry => { if (entry[0].test(query)) hits[entry[1]] = true; });
  return hits;
}

function iconPickerMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const hits = iconSearchHits(q);
  return ICON_GROUPS
    .map(group => ({
      name: group.name,
      icons: group.icons.filter(n =>
        n.indexOf(q) !== -1 || hits[n] || group.name.toLowerCase().indexOf(q) !== -1)
    }))
    .filter(group => group.icons.length);
}

function iconPickerHtml() {
  const state = iconPickerState;
  const groups = iconPickerMatches(state.query) || ICON_GROUPS;
  const suggested = guessIcon(state.name, state.kind);
  return `
    <div class="modal-heading">Choose an Icon</div>
    ${textFieldHtml("icon-search", "Search", state.query, { placeholder: "sword, fire, bag\u2026" })}

    <button class="icon-auto${state.current ? "" : " chosen"}" id="icon-auto">
      ${suggested ? iconSvg(suggested) : ""}
      <span>
        <span class="icon-auto-title">Automatic</span>
        <span class="icon-auto-hint">${suggested
          ? "Read from the name — currently " + esc(suggested)
          : "Read from the name"}</span>
      </span>
    </button>

    ${groups.length ? groups.map(group => `
      <div class="breakdown-subhead">${esc(group.name)}</div>
      <div class="icon-grid">
        ${group.icons.map(n => `
          <button class="icon-cell${n === state.current ? " chosen" : ""}" data-icon-pick="${esc(n)}" title="${esc(n)}">
            ${iconSvg(n)}
          </button>`).join("")}
      </div>
    `).join("") : `<div class="empty-hint">Nothing matches “${esc(state.query)}”.</div>`}
  `;
}

function wireIconPicker() {
  const search = document.getElementById("icon-search");
  search.addEventListener("input", () => {
    iconPickerState.query = search.value;
    redrawIconPicker();
    const again = document.getElementById("icon-search");
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  });

  document.getElementById("icon-auto").addEventListener("click", () => {
    const pick = iconPickerState.onPick;
    closeIconPicker();
    pick("");
  });

  document.querySelectorAll("[data-icon-pick]").forEach(cell => {
    cell.addEventListener("click", () => {
      const pick = iconPickerState.onPick;
      const chosen = cell.dataset.iconPick;
      closeIconPicker();
      pick(chosen);
    });
  });
}

/* The button that opens it, for a form. Shows what the thing will actually
   look like if saved right now -- including the automatic guess, which is why
   it takes the live name field rather than the stored one. */
function iconFieldHtml(id, chosen, nameForGuess, kind) {
  return fieldHtml("Icon", `
    <button type="button" class="icon-field" id="${id}">
      ${iconSvg(chosen && ICONS[chosen] ? chosen : guessIcon(nameForGuess, kind))}
      <span>${chosen && ICONS[chosen] ? esc(chosen) : "Automatic"}</span>
    </button>`);
}

/* Wires that button. `get`/`set` rather than a stored value, because the form
   redraws the button after every pick and the caller owns where the choice
   lives -- a local in the Add flow, the item itself in the editor. */
function wireIconField(id, nameFieldId, get, set, kind) {
  const button = document.getElementById(id);
  if (!button) return;
  const redraw = () => {
    const chosen = get();
    const nameEl = document.getElementById(nameFieldId);
    const live = nameEl ? nameEl.value : "";
    button.innerHTML = iconSvg(chosen && ICONS[chosen] ? chosen : guessIcon(live, kind))
      + `<span>${chosen && ICONS[chosen] ? esc(chosen) : "Automatic"}</span>`;
  };
  button.addEventListener("click", () => {
    const nameEl = document.getElementById(nameFieldId);
    openIconPickerModal(get(), (picked) => { set(picked); redraw(); },
      { name: nameEl ? nameEl.value : "", kind: kind });
  });
  // an automatic icon changes as you type the name, so the button has to follow
  const nameEl = document.getElementById(nameFieldId);
  if (nameEl) nameEl.addEventListener("input", () => { if (!get()) redraw(); });
}
