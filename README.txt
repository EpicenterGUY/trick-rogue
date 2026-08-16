TRICK//ROGUE GitHub-ready
Open index.html in a browser. Card images are under assets/cards/.

Card data
---------
`cards.js` is the single source of truth for active named-card identity, printed
suit/rank, description, terms, image, and pack membership. The active named pool
is exactly the ten cards in `pack01`, using `assets/cards/pack01`.

The standard deck remains 52 suit/rank slots. A slot without a named definition
is created as a pure playing card with no effect. Files under
`assets/cards/legacy` are archived artwork only and are deliberately not loaded
or referenced by active card data.

Card packs
----------
`CARD_PACK_LIST` is the central registry. Every entry provides `id`, `name`,
`version`, `enabledByDefault`, `rewardWeight`, and `cards`. A run snapshots the
selected IDs in `enabledPacks`; only those packs contribute reward candidates.

To add an approved pack, copy `card-packs/pack02.example.js` to `packNN.js`, add
its ten approved images under `assets/cards/packNN/`, register the module and its
metadata in `CARD_PACK_LIST`, add handlers only for exceptional effects, then run
`npm test`. The template deliberately defines no new card names or effects.

Validation
----------
Run `npm test` to check the active named-card count, pack size, unique IDs,
reward candidates, pure base cards, all 52 base slots, images, terms, effects,
and handlers.
