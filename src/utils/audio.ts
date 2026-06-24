/**
 * Web Audio API synthesizer for queue calling sounds
 */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    
    // First tone (G4 - 392Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(392, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second tone (C5 - 523.25Hz) after a short delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.25);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.2);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.8);
    
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (e) {
    console.warn("Could not play queue chime:", e);
  }
}

/**
 * Speech synthesis for calling a ticket number in German
 */
export function speakCall(ticketNumber: number, name?: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    
    // Cancel any active speech
    window.speechSynthesis.cancel();
    
    let text = `Nummer ${ticketNumber} bitte.`;
    if (name && name.trim()) {
      text = `Nummer ${ticketNumber}, ${name}, bitte.`;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 0.9; // Slightly slower for clear pronunciation
    utterance.pitch = 1.0;
    
    // Attempt to select a German voice
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find(voice => voice.lang.startsWith("de"));
    if (deVoice) {
      utterance.voice = deVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Speech synthesis failed:", e);
  }
}
