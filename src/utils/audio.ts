// Notification sound utility
let audioContext: AudioContext | null = null;
let isMuted = false;

export function playNotificationSound() {
  if (isMuted) return;

  try {
    // Try HTML5 Audio first (for mp3 file)
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Fallback to Web Audio API if file not found
      playFallbackSound();
    });
  } catch (err) {
    playFallbackSound();
  }
}

function playFallbackSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem("notifications-muted", String(isMuted));
  return isMuted;
}

export function isNotificationMuted(): boolean {
  const saved = localStorage.getItem("notifications-muted");
  isMuted = saved === "true";
  return isMuted;
}