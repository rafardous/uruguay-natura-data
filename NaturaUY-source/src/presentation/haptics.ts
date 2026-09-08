import { Platform } from 'react-native';
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
 * Closing/back controls use the light tap as well; continuous gestures and
 * passive surfaces remain silent so feedback keeps its meaning.
 */

/**
 * A device with no motor — or one where the user has switched haptics off —
 * rejects. Feedback the user never receives must not surface as an error
 * either, so every call is fire-and-forget.
 */
function fire(run: () => Promise<void>): void {
  run().catch(() => {});
}

function androidOr(platform: Haptics.AndroidHaptics, fallback: () => Promise<void>): Promise<void> {
  return Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(platform) : fallback();
}

export const haptics = {
  tick: (): void => fire(() => androidOr(Haptics.AndroidHaptics.Segment_Frequent_Tick, () => Haptics.selectionAsync())),
  tap: (): void => fire(() => androidOr(Haptics.AndroidHaptics.Context_Click, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  press: (): void => fire(() => androidOr(Haptics.AndroidHaptics.Long_Press, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))),
  success: (): void => fire(() => androidOr(Haptics.AndroidHaptics.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
  error: (): void => fire(() => androidOr(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))),
};
