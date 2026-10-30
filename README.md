# ISFW

Text-based idle/incremental game disguised as a data monitor.

## Run

Double-click `start.bat` (needs Python). It starts `server.py`, which opens the
game at http://localhost:8000. Keep that window open while playing; close it to
stop the server. Only one server can run at a time: if the port is taken (an
older server window is still open), the new one says so and stops.

A server is needed because the code uses ES modules, which browsers block when
opening `index.html` directly from disk. `server.py` also turns caching off and
lets the dev screens save their files.

The top band switches between **monitor** (the game), **dev/enemies** and
**dev/skills**.

## Online versions (GitHub Pages)

| version     | branch | address                             | dev pages |
|-------------|--------|-------------------------------------|-----------|
| playable    | `main` | https://dellay-h.github.io/isfw/     | none |
| development | `dev`  | https://dellay-h.github.io/isfw/dev/ | read-only, or editable after signing in |

`.github/workflows/pages.yml` publishes both on every push to `main` or `dev`
(only `index.html`, `css/` and `js/`, with a generated `js/site.js` saying
which version each copy is). Pages only deploys from `main`, so a push to
`dev` restarts the workflow on `main`, which builds both branches. One-time
setup: repo Settings → Pages → Source: **GitHub Actions**.

The two versions share one address, so the dev version keeps its game save,
drafts and settings in the browser under `isfw.devsite.*`; the playable save
(`isfw.save.v3`) is never touched by it.

### Editing online (dev version)

1. Create a fine-grained token: GitHub → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate new token.
   Resource owner **dellay-h**, Repository access **Only select repositories:
   isfw**, Permissions → Repository: **Contents: Read and write** and
   **Workflows: Read and write** (needed to release when `dev` changed files
   in `.github/workflows/`). Set an expiration.
2. Open the dev version, go to dev/enemies or dev/skills, paste the token,
   **sign in**. The token is kept only in that browser; **sign out** removes it.
3. Signed in, the dev pages load `enemies.js` / `skills.js` straight from the
   `dev` branch (always the latest commit, no waiting for the site to update).
   Edits are kept in the browser as drafts ("uncommitted changes"); "apply to
   game" plays them without committing.
4. **commit** writes the changed files to `dev` as one commit (optional
   message). If a file changed on `dev` since the page loaded it (e.g. a commit
   from another computer), nothing is committed: reload to get the newer
   version; the conflicting edits are kept aside in the browser.
5. **release to playable** (click twice) moves `main` to `dev` (or merges
   `dev` into `main` if `main` has commits of its own). The playable site
   updates about a minute later. It needs all changes committed first.

Locally (`start.bat`) nothing changes: the dev pages save straight to the
files. Online commits land on GitHub, so run `git pull` (on the branch you
work on, usually `dev`) before editing locally.

## Layout

- `index.html` – page skeleton
- `css/style.css` – styling
- `js/data.js` – player base stats, reward rules, attribute and bonus lists; loads the data files
- `js/enemies.js` – enemies (written by dev/enemies, can be edited by hand)
- `js/skills.js` – skills (written by dev/skills), shared by the player and enemies: S.. skills, X.. specials
- `js/shop.js` – prestige (P..) and essence (N..) shop items, retired ones included (written by dev/shop)
- `js/game.js` – state, save/load, units, combat simulation (no DOM)
- `js/main.js` – game loop, monitor rendering, input, view switching
- `js/dev.js`, `js/dev/*.js` – dev screens (shared store, enemy page, skill page, shop page, run page)
- `js/serialize.js` – writes `enemies.js` / `skills.js` / `shop.js` source
- `js/migrate.js` – converts dev edits saved in the old enemy format
- `design/` – design notes: archetype ideas, skill ideas
- `server.py` – local server (no caching, `/api/ping`, saves `/api/enemies`, `/api/skills` and `/api/shop`)
- `js/site.js` – which version this copy is (local / play / dev) and browser storage names; replaced in the online copies
- `js/github.js` – GitHub access for the online dev version (load, commit, release)
- `.github/workflows/pages.yml` – publishes the playable and dev versions to GitHub Pages

## Dev screens

Every edit is saved to its file right away. "apply to game" reloads the page
so the game uses the new data. If a save fails, the status line says why, the
edits are kept in the browser (the header shows "dev draft") and are saved with
the next change. If the page is not served by `server.py`, a red banner says so.
Kept edits are only used while the file is still the version they were made
from; if the file changed in the meantime, the file wins and the edits are set
aside (the banner says so). A page that loaded an older version of a file can't
save over a newer one: the server refuses it and the page asks for a reload.

### dev/enemies
Each enemy is an expandable entry with four expandable fields:
- **attributes**: rank (sets the default max kills), hp and max kills always; add tier and any base
  attribute (dmg, aspd, mag pwr, mag spd, max mp, mp regen, armor, block,
  block shred, regen; negative regen = decay).
- **skills**: the enemy's own skills (and level). It uses all of them, like
  loaded skills. Shows each resulting attack/spell and the dps. "+ new skill"
  creates one and opens it in dev/skills.
- **attribute rewards**: attribute + total (flat or %) gained over all kills.
  Each kill gives its share (the first kill counts x4), so the
  total doesn't change when max kills does. The per-kill amounts are shown.
- **skill rewards**: skill (or special), level, and the kill that awards it
  (first, final, or a kill number).

On the right, **player preview** shows the player's attributes, unlocked skills
and slots for a set of kills: add enemies and kill counts, "all at max", or
"from game" (your current save).

### dev/skills
Each skill is an expandable entry: id, name, "special" (always active once
unlocked, never loaded into a slot), and its levels. Each level is expandable
and holds effects: attack, spell, on-hit damage, empower, attribute bonuses,
skill slots. Later levels add to the levels before them. Each skill shows which
enemies award it to the player and which enemies use it. Changing a skill id
updates the enemies that refer to it.

### dev/shop
Prestige and essence shop items, grouped by shop, with retired items last.
Each item: id, name, shop, "retired" (out of the game; saves that bought it
get the cost back in points or essence), max level (prestige items), cost
(first level + increase per level bought, with the cost of the first levels
shown), attribute bonuses per level, and other effects (skill slots, start
kills, max kills growth per rank, minimum max kills per rank, required item,
unlocks essence, free skills, auto-equip). Changing an id updates the items
that require it. Prefer retiring to deleting an item players may own.

## Rules (v0.33)

### Units
The player and enemies work the same way: base attributes plus a set of active
skills. Attributes are never modified directly; every change is an *effect*
(kill rewards, active skills) recomputed from state:
attribute = (base + sum of flat effects) x (1 + sum of % effects).
- Player: base 20 max hp, 0 everything else; active skills = loaded skills
  (2 slots, plus specials' extra slots) + unlocked specials.
- Enemy: its base attributes; active skills = its skill list.

### Player
- HP and mana carry over between fights; mana regenerates in and out of
  fights. When max hp changes, current hp is scaled so the hp % stays the same.
- Out of combat the player regenerates 10% of max hp + 1 hp per second.
- Reaching 0 hp simply ends the fight. No other penalty. Debuffs and shields
  are cleared when a fight ends.
- "repeat" starts the next fight immediately after a win, at current hp.
  After a defeat (except against a boss) it waits until hp is fully regenerated, then retries the same
  enemy (stop, or starting another fight, cancels the pending retry).
- Enemies start each fight at full hp and mana.

### Attacks and spells
- **attack**: hit = base + damage x scaling; uses per second = 1 / interval
  + attack speed x speed scaling. Reduced by the target's armor and block.
  Triggers on-hit damage and empower.
- **spell**: hit = base + magic power x scaling; uses per second = 1 / interval
  + magic speed x speed scaling. Ignores armor and block. Mana costs wait until
  enough mana is available.
- Options: several hits per use, damage over time (stacks, ignores armor and
  block), shield (temporary hp, absorbs damage first; a new cast replaces the
  old one), self-heal, lifesteal, countdown (shown in the process panel).
- **On-hit damage** is added to every attack hit as its own damage source,
  reduced by armor and block separately.

### Defenses
- Armor reduces attack hits by armor / (armor + 100); block then removes a
  flat amount from each hit (never below 0).
- Armor penetration ignores that much of the target's armor for one attack.
  Block shred lowers the target's block by that much per attack hit, for the
  rest of the fight.

### Progress
- Enemies have a rank: common (200 kills), elite (25), boss (5), tutorial
  (the rotting plant, 10) or challenge (1). Each can be defeated up to its max
  kills. Challenges are listed above tier 0 and award specials.
- Tiers: 0 rotting plant; 1 slime, archer, goblin, dropout sorcerer, fire wizard
  apprentice (elite), werewolf (boss); 2 assassin (elite), ogre, guard (elite),
  satyr archer, arcane wizard apprentice (elite). Challenge: elder sapling
  (no attack, 120 hp, regenerates 5 hp/s; awards X03 deep roots, +1 slot).
- Enemies use the same skills as the player; their base attributes (which
  can be negative, e.g. a slower attack speed) tune them. New skills for this:
  S13 magic bolt, S14 fireball, S15 heal.
- The werewolf (tier 1 boss) has 300 hp, a basic attack and a bite (every 4 s),
  and heals 150% of the damage its attacks deal (base attribute "lifesteal";
  the bite adds 50% more). Its power is tuned with lifesteal first, then
  "regen % max hp/s" (currently 0). With tier 1 cleared and the challenge's
  slot, basic attack + gel coat + quick attack + burn wins it in about 15 s.
  First kill: X02 pack instinct (+1 slot); final kill: S10 bite.
- Attribute rewards are totals over all kills; the first kill counts as 4 kills.
  - Common: two waves. Kills 1–50 give half of the total, kills 51–200 the
    other half, evenly. Their skill rewards that were on the final kill are on
    kill 50.
  - Elite, boss, tutorial: after n kills the player has
    total x weight(n) / weight(max), with weight(n) = n + 3.
- Balancing heuristic for commons: a fully defeated common raises the matching
  player attribute by 20%, measured when the player reaches it (all lower tiers
  fully defeated, no skills). Attributes that start at 0 are measured with what
  they act on: dmg on top of the starting attack's 2 hit, aspd on its 1 attack/s,
  mag spd on the first spell's 0.25 casts/s. dev/enemies shows this suggestion
  next to each common reward (HEURISTIC in data.js).
- Each skill level is awarded by an enemy kill (its skill rewards). Levels are
  reached in order and are additive. Skill effects are only active while
  loaded (specials always).
- Hover the ? next to a player attribute for its breakdown. In the targets
  table, hover "stats" for an enemy's attributes and attacks, and "rewards" for
  its attribute rewards (total, earned, next kill) and skill rewards.
- Only kills, slots, current hp/mana, totals, the repeat toggle and a pending
  retry are saved (browser localStorage, key isfw.save.v3, every 2s).

Enemy and skill data: see dev/enemies and dev/skills (or `js/enemies.js`,
`js/skills.js`).
