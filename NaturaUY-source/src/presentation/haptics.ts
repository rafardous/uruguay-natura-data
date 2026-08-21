import * as Haptics from 'expo-haptics';

/**
 * The app's haptic vocabulary.
 *
 * Kept behind semantic names — the same reasoning as `TabIcons` — so the
 * *meaning* of a buzz is decided here once, rather than each screen picking an
 * `ImpactFeedbackStyle` on its own and the app ending up with five different
 * intensities for the same kind of action.
 *
 * The levels, weakest to strongest:
 *
 *   tick     crossing a detent — a row scrolling past, a chip, a tab, a radio
 *   tap      opening or committing something small
 *   press    a deliberate action with weight — saving, starting a run
 *   success  the outcome was right
 *   error    the outcome was wrong
 *
 * `tick` uses `selectionAsync` rather than an impact style: it's the soft,
 * discrete click an alarm picker makes as the digits pass under your thumb —
 * each crossing feels individual instead of one continuous buzz.
 *
 * Deliberately absent: closing, and anything that fires continuously without a
 * detent to mark. Feedback on every touch stops being feedback.
 */

/**
 * A device with no motor — or one where the user has switched haptics off —
 * rejects. Feedback the user never receives must not surface as an error
 * either, so every call is fire-and-forget.
 */
function fire(run: () => Promise<void>): void {
  run().catch(() => {});
}

export const haptics = {
  tick: (): void => fire(() => Haptics.selectionAsync()),
  tap: (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: (): void => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
