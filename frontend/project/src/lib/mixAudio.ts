// Schedule fades on the audio clock so a throttled UI timer cannot stall them.
// GainNodes also work on iOS, where HTMLMediaElement.volume is device-controlled.
export class MixAudio {
  private context: AudioContext | null = null;
  private gains = new Map<HTMLAudioElement, GainNode>();
  private master: GainNode | null = null;

  enable(elements: HTMLAudioElement[], active: HTMLAudioElement, volume: number) {
    if (this.context) return;
    const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return;
    const context = new Constructor();
    this.context = context;
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
    this.master = master;
    for (const element of elements) {
      const gain = context.createGain();
      gain.gain.value = element === active ? 1 : 0;
      context.createMediaElementSource(element).connect(gain);
      gain.connect(master);
      this.gains.set(element, gain);
      element.volume = 1;
      if (element !== active) {
        // Prime the second media element in the original Play gesture for iOS.
        // Its deck gain is zero and this tiny WAV contains only silence.
        const silence = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YQIAAACAgA==';
        element.src = silence;
        element.muted = false;
        void element.play().catch(() => {}).finally(() => {
          if (element.getAttribute('src') !== silence) return;
          element.pause(); element.removeAttribute('src'); element.load();
        });
      }
    }
  }
  get running() { return this.context?.state === 'running'; }
  get enabled() { return this.context !== null; }
  resume() { return this.context?.resume(); }
  volume(value: number) {
    if (this.master && this.context) this.master.gain.setValueAtTime(value, this.context.currentTime);
  }
  level(element: HTMLAudioElement, value: number, seconds = 0) {
    const gain = this.gains.get(element)?.gain;
    const context = this.context;
    if (!gain || !context) return;
    gain.cancelScheduledValues(context.currentTime);
    gain.setValueAtTime(gain.value, context.currentTime);
    if (seconds > 0) gain.linearRampToValueAtTime(value, context.currentTime + seconds);
    else gain.setValueAtTime(value, context.currentTime);
  }
  close() {
    void this.context?.close().catch(() => {});
  }
}
