class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.gainNode = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Initialize the singleton HTMLAudioElement
    this.getAudioElement();
  }

  getAudioElement(): HTMLAudioElement {
    if (!this.audioElement && typeof window !== "undefined") {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = "anonymous";
      this.audioElement.preload = "auto";
      
      // Automatically connect it if ctx is initialized
      if (this.ctx) {
        this.connectMediaElement(this.audioElement);
      }
    }
    return this.audioElement!;
  }

  getAnalyser() {
    return this.analyser;
  }

  getContext() {
    return this.ctx;
  }

  connectMediaElement(audio: HTMLAudioElement) {
    if (!this.ctx) this.init();
    // Only create one source node per media element to avoid DOMException
    if (!this.mediaSourceNode || this.mediaSourceNode.mediaElement !== audio) {
      try {
        this.mediaSourceNode?.disconnect();
        this.mediaSourceNode = this.ctx!.createMediaElementSource(audio);
        this.mediaSourceNode.connect(this.gainNode!);
      } catch (e) {
        console.error("[AudioEngine] failed to connect media element source:", e);
      }
    }
  }

  setVolume(vol: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
