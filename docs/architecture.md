## Why Amnesia

Every note app I've ever used optimizes for the same thing: getting the thing back to
you as fast as possible. Write it, sync it, see it. That is exactly the wrong tool for
the kind of writing that is only worth reading after the moment has passed - a letter to
yourself, a snapshot of a marriage, an honest note about a bad week. Read immediately,
those notes age badly; read a year later, they become evidence.

Amnesia is the opposite product. It takes your writing, locks it up, and refuses to
give it back for a year. The name is a lie on purpose: Amnesia remembers perfectly, it
just doesn't let you in early. The whole point is to remove the person from the loop so
the memory survives the exact person who wrote it.

The name of the game is constraint. One memory per archive per day, sealed until the
same UTC date and time one year later, then released by the next Timekeeper run.

## What "one year" means

A memory is sealed with an `unlock_at` timestamp: the same UTC calendar date, one year
later (`server/db.ts` - `unlockDate.setUTCFullYear(unlockDate.getUTCFullYear() + 1)`).
Leap days resolve deterministically - a memory sealed on Feb 29 rolls forward to March 1
in the following (non-leap) year rather than throwing. In practice this affects at most
one day per memory, which is a rounding error on a one-year wait.

"One year" is enforced in two independent layers:

1. The Timekeeper marks memories due: `WHERE unlock_at <= now AND unlocked = 0`.
2. The server refuses to serve any memory that isn't both marked *and* past its
   `unlock_at` (`isMemoryReleased` in `server/db.ts`). This double-check exists so a
   bug or a tampered flag can never leak content before the anniversary.

Two honest caveats that belong in writing:

- The release is enforced by the server. If someone holds your Recovery Phrase *and*
  captures the ciphertext from the database before release, they can decrypt it.
- "One year" is the *archive's* interval. Drafts live in your own sessionStorage while
  you write, and anything you type on your own device already exists as a copy wherever
  you typed it. The seal protects the archived copy.

## Why encryption happens in the browser

Because I wanted the server to be useless.

Under the published client code, encryption happens in the browser. In the browser
(`src/lib/crypto.ts`), the Memory Key is run through PBKDF2 (600,000 iterations) then
HKDF to derive an AES-256-GCM key, and the memory is encrypted before a single byte is
sent. Plaintext is never intentionally sent to or stored by the server: it stores
ciphertext, and the plaintext is recoverable only with the key, which the server never
sees and never stores.

This is not "zero-knowledge" in the adversarial sense. Amnesia supplies the browser
application itself, so a compromised or malicious server could serve altered JavaScript
that captures a Recovery Phrase or plaintext before it is encrypted. This matches the
caveat already stated on the About, Privacy, and Terms pages.

It's not just about eavesdroppers. I host this on my own hardware, but I refuse to write
software that assumes I'm trustworthy forever - or that the machine will never be
confiscated, stolen, or backed up to the wrong place. If someone walks off with the Pi
and the SQLite file, all they get is noise. There is no "reset my key" button, no
support ticket, no recovery bypass, because a bypass would make the encryption theater.

A few structural details that make it hold up:

- The browser derives separate lookup and authentication verifiers from the Recovery
  Phrase. The server stores only peppered HMAC identifiers derived from those
  verifiers; the raw phrase never reaches it. Scrypt remains only for legacy V1
  compatibility.
- Every ciphertext is cryptographically bound to its archive and memory metadata
  through AAD, so moving or altering a package causes authenticated decryption to
  fail.
- On top of the client encryption, the server applies an additional AES-256-GCM
  wrapper (`createTimekeeperLayer`) and refuses to return its release material
  through the API until the anniversary. So even the *inner* ciphertext structure
  isn't available before release.

## What the Timekeeper can and cannot guarantee

The Timekeeper is the server-side process that runs on a timer and marks due memories
unlocked (`runTimekeeperProcess` in `server/db.ts`), logging each run to
`timekeeper_logs`. In production it's a systemd timer (`npm run timekeeper`), with a
catch-up run at server startup so a machine that was offline on an anniversary doesn't
sleep through it.

What it **can** guarantee:

- A sealed memory is not served before its anniversary. The server literally doesn't
  hand over the material needed to decrypt until the Timekeeper has released it and the
  clock has caught up.
- While the database remains intact and the service continues operating, a due memory
  is released by the next timer or startup catch-up run. Worst case, a short delay
  while the timer fires.

What it **cannot** guarantee:

- It is not a cryptographic time-lock. The release is a policy enforced by the server
  process, not a mathematical one. If you have the key and a copy of the ciphertext,
  the Timekeeper is irrelevant.
- It can't protect your own copies. Anything you wrote in a browser tab, or any note you
  pasted from, is a copy that was never sealed.
- It can't enforce forgetting. Once released, the memory stays in the archive and stays
  readable. Amnesia delays, it doesn't destroy. If you want the memory gone, you delete
  the archive.

## Why it runs on a Raspberry Pi

I don't want a landlord for my memories. A Pi Zero 2 WH is a ~$15, always-on, whisper-quiet
computer that draws a few watts and does one job. Amnesia is designed around that modesty:
SQLite instead of a database server, Node with a small surface, no build service, no
cloud storage. It lives in my house, behind a reverse proxy or Cloudflare Tunnel, bound
to 127.0.0.1 so it's never exposed on a LAN (let alone the internet) without me
deliberately letting it out.

The Pi also earns the aesthetic honestly. The machine page shows real load average, real
temperature, real uptime, the actual size of the database on disk. There is a machine
back there ticking, and I wanted the site to admit it - "Running quietly on a Raspberry
Pi Zero 2 WH" is not marketing, it's a bill of materials.

A device that small has real constraints, and I consider them features:

- Slow enough that I never wanted to build heavy client-side crypto - WebCrypto handles
  it fine, and PBKDF2's 600k iterations take longer in the browser than they do as a
  server-side DoS multiplier.
- Small enough that one memory per day per archive (~365 entries a year) is the natural
  scale. Amnesia is a year of someone's life, not a data lake.
- A single always-on box in my home is the best "the Timekeeper is real" story I could
  tell. The process that wakes your memories is a cron job on a little computer that
  never sleeps.

If the Pi itself fails but its storage or a consistent off-device backup survives,
Amnesia can be restored. If the only SD card dies without a database backup, the
memories die with it. Encryption protects confidentiality; backups protect survival.
