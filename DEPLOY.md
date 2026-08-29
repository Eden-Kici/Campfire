# Getting Campfire onto your phones

Fifteen minutes, most of it waiting. You need a GitHub account; everything else is done.

Your repo is **https://github.com/Eden-Kici/Campfire** and it is empty, so the first push is clean.

## 1. Push the code

**Double-click `push-campfire.bat` on your Desktop.** It commits everything and pushes.

A login window may appear the first time. If it asks for a *password*, GitHub actually wants a
**personal access token**: github.com → Settings → Developer settings → Personal access tokens →
Tokens (classic) → Generate new token → tick `repo` → use the token as the password.

Doing it by hand instead, in `H:\Files\Code\Campfire-Player-Demo`:

```bash
git add -A
git commit -m "Phone-ready: PWA shell, viewport, touch fixes"
git remote add origin https://github.com/Eden-Kici/Campfire.git
git branch -M main
git push -u origin main
```

**A note on folders.** The work lives in `H:\Files\Code\Campfire-Player-Demo`, which has the full
history — that is the one to push. `C:\Users\kicie\Documents\GitHub\Campfire` is a separate empty
folder; ignore it, or delete it and `git clone` fresh after the push if you prefer your code under
Documents. Don't work in both.

## 2. Turn on Pages

Open **https://github.com/Eden-Kici/Campfire/settings/pages** → Source: **Deploy from a branch** →
Branch: **main**, folder: **/ (root)** → **Save**.

Wait about a minute. Your address is:

```
https://eden-kici.github.io/Campfire/
```

Refresh the Pages settings page until the link appears — the first build is the slow one.

## 3. Install it on each iPhone

**It has to be Safari.** Other browsers on iOS either hide the option or add a bookmark instead.

1. Open the address in **Safari**
2. Tap **Share** (the square with the arrow)
3. Scroll down → **Add to Home Screen**
4. Name it **Campfire** → **Add**

You now have an icon on the home screen. Open it: no URL bar, no tabs, no Safari at all.

**Do this rather than bookmarking it.** Safari deletes a site's stored data after seven days of not
being used — but Apple exempts apps added to the home screen. Bookmark it and your characters can
vanish before the exam; install it properly and they stay.

## 4. Check it works with no signal

Turn on Aeroplane Mode and open the icon. The whole app should load — all 319 spells, your
characters, everything. If it does, it is genuinely installed rather than just a saved link.

## Shipping a change later

Double-click `push-campfire.bat` again — it commits and pushes whatever changed. If you added or
removed a file, run `node tools/build-sw.js` first so the offline copy stays complete.

Pages redeploys in about a minute. On the phone, close the app from the app switcher and reopen it
twice — the first launch fetches the update, the second runs it.

`tools/build-sw.js` bumps the cache version, which is what tells the phone to throw the old copy
away. The `structure` test suite fails if you add a file and forget to run it.

## If something goes wrong

**The icon opens Safari with a URL bar** — it was added as a bookmark, not a home-screen app. Delete
it and redo step 3 in Safari.

**A blank page** — check the address ends in a `/`. Pages serves the app from a subfolder and the
trailing slash matters.

**Changes don't show up** — the service worker is serving the cached copy. Delete the icon,
reinstall it, or run `node tools/build-sw.js`, commit and push to bump the cache version.

**404 after enabling Pages** — the first build takes a minute or two. If it persists, check
Settings → Pages is pointing at `main` and `/ (root)`.
