class YouTubePlayerEngine {
  private player: any = null;
  private isReady = false;
  private pendingVideoId: string | null = null;
  private pendingSeekTo: number | null = null;
  private pendingPlay = false;
  private volume = 80; // default 0-100
  private isMuted = false;

  init(containerId: string) {
    if (typeof window === "undefined") return;
    if ((window as any).YT && (window as any).YT.Player) {
      this.createPlayer(containerId);
      return;
    }

    // Register global callback
    const previousCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      this.createPlayer(containerId);
    };

    // Load the script if not already loaded
    if (!document.getElementById("yt-iframe-api-script")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }

  private createPlayer(containerId: string) {
    if (this.player) return;
    try {
      this.player = new (window as any).YT.Player(containerId, {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: () => {
            console.log("[YTPlayer] Player is ready");
            this.isReady = true;
            this.player.setVolume(this.volume);
            if (this.isMuted) this.player.mute();
            else this.player.unMute();

            if (this.pendingVideoId) {
              this.loadAndPlay(this.pendingVideoId, this.pendingSeekTo ?? 0, this.pendingPlay);
              this.pendingVideoId = null;
              this.pendingSeekTo = null;
              this.pendingPlay = false;
            }
          },
          onStateChange: (event: any) => {
            // Can listen to state changes if needed
          },
          onError: (event: any) => {
            console.error("[YTPlayer] Error:", event.data);
          }
        }
      });
    } catch (e) {
      console.error("[YTPlayer] Failed to create player:", e);
    }
  }

  loadAndPlay(videoId: string, startSec: number, play: boolean) {
    if (!this.isReady || !this.player) {
      this.pendingVideoId = videoId;
      this.pendingSeekTo = startSec;
      this.pendingPlay = play;
      return;
    }

    try {
      // Check if video is already loaded by parsing the URL
      const currentUrl = this.player.getVideoUrl?.() ?? "";
      const isSameVideo = currentUrl.includes(videoId);

      if (!isSameVideo) {
        this.player.cueVideoById({
          videoId: videoId,
          startSeconds: startSec
        });
      } else {
        this.player.seekTo(startSec, true);
      }

      if (play) {
        this.player.seekTo(startSec, true);
        this.player.playVideo();
      } else {
        this.player.pauseVideo();
      }
    } catch (e) {
      console.error("[YTPlayer] loadAndPlay failed:", e);
    }
  }

  play() {
    if (this.isReady && this.player) {
      this.player.playVideo();
    }
  }

  pause() {
    if (this.isReady && this.player) {
      this.player.pauseVideo();
    }
  }

  seekTo(seconds: number) {
    if (this.isReady && this.player) {
      this.player.seekTo(seconds, true);
    }
  }

  setVolume(vol: number) {
    // vol is 0 to 1
    const ytVol = Math.round(vol * 100);
    this.volume = ytVol;
    this.isMuted = ytVol === 0;
    if (this.isReady && this.player) {
      this.player.setVolume(ytVol);
      if (ytVol === 0) this.player.mute();
      else this.player.unMute();
    }
  }

  getCurrentTime(): number {
    if (this.isReady && this.player && this.player.getCurrentTime) {
      return this.player.getCurrentTime();
    }
    return 0;
  }
}

export const ytPlayerEngine = new YouTubePlayerEngine();
export default ytPlayerEngine;
