/** Must not contain ':' or '-' (expo-notifications category rules). */
export const TRAINING_CATEGORY_ACTIVE = "training_controls_active";
export const TRAINING_CATEGORY_PAUSED = "training_controls_paused";

export const ACTION_FINISH = "finish_training";
export const ACTION_PAUSE = "pause_training";
export const ACTION_CANCEL = "cancel_training";
export const ACTION_RESUME = "resume_training";

export const CHANNEL_ACTIVE = "training_active";
export const CHANNEL_PAUSED = "training_paused";
export const CHANNEL_FINISHED = "training_finished";

export const NOTIFICATION_COLOR_ACTIVE = "#3b82f6";
export const NOTIFICATION_COLOR_PAUSED = "#64748b";
export const NOTIFICATION_COLOR_FINISHED = "#16a34a";

/** Stable id so updates replace the same notification. */
export const ONGOING_TRAINING_NOTIFICATION_ID = "fitbody_ongoing_training_v1";

export const SOUND_ACTIVE = "training_active.wav";
export const SOUND_PAUSED = "training_paused.wav";
