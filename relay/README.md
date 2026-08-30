# Campfire Relay

A message relay for the party feature. It is not part of the app: the app has
no dependencies and never will, this has one (`ws`) and runs on a server.

It knows nothing about D&D. A socket joins a room, and anything it sends is
copied to the other sockets in that room. Every decision about what a message
means, and who is allowed to see what, stays in the app.

## Why it is hosted rather than run on a laptop

The app is served over HTTPS from GitHub Pages, and a page on HTTPS is not
allowed to open a plain `ws://` connection. Browsers block it as mixed content,
with no override on iOS. So the relay has to be somewhere with a real
certificate, which in practice means hosted.

## Why one always-on instance, not serverless

Rooms live in memory. A serverless host that scales to several isolates would
cheerfully put two phones in the same room on two different machines, and
neither would ever hear the other. One instance means one room.

## Deploying to Render (free)

1. Make sure this folder is pushed to GitHub.
2. Sign in at <https://render.com> with GitHub.
3. **New → Web Service**, connect the `Campfire` repo.
4. Set:
   - **Root Directory**: `relay`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Create it and wait for the first deploy.
6. Open the URL it gives you. It should print `campfire relay ok`.

The app wants that same host with a `wss://` scheme, so
`https://campfire-relay-xyz.onrender.com` becomes
`wss://campfire-relay-xyz.onrender.com`. That goes in Options → Relay.

## Before you demo

A free Render service **sleeps after 15 minutes idle and takes about
50 seconds to wake**. Open the relay URL in a browser a minute before you
present. Once it prints `campfire relay ok` it stays awake for the session.

This is the one moving part that can embarrass you, so it is worth doing even
if you think it is already awake.

## Running it locally

    cd relay && npm install && npm start

Listens on 8787. Local development only: a phone on `https://` cannot reach it.
