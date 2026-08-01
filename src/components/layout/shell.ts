/**
 * The width of the app's content column.
 *
 * The shell is mobile-first, but it ships to the web — without a cap, every
 * card stretched the full desktop viewport (a 1600px-wide chart of eight
 * points). TopBar, BottomNav and <main> all constrain their *contents* to this
 * width while their own backgrounds and borders still span the viewport, so
 * the bars read as full-width chrome with the nav items aligned to the
 * content beneath them.
 *
 * Shared so the three can't drift apart — if they did, the nav would sit off
 * to one side of the cards it belongs to.
 */
export const CONTENT_COLUMN = "mx-auto w-full max-w-lg"
