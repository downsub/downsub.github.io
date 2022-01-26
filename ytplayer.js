export class YtPlayerStateWaiter extends Promise {
  constructor(player, state) {
    let handlers;
    super((resolve, reject) => handlers = {resolve, reject});
    this._handlers = handlers;
    this._state = state;
    player.stateWaiters[state].push(new WeakRef(this));
  }
  static resolveAll(player, state, data) {
    for (const ref of player.stateWaiters[state]) {
      const waiter = ref.deref();
      if (waiter) waiter._handlers.resolve(data);
    }
  }
  static rejectAll(player, state, data) {
    for (const ref of player.stateWaiters[state]) {
      const waiter = ref.deref();
      if (waiter) waiter._handlers.reject(new Error(`Player error: ${data}`));
    }
  }
  static [Symbol.species] = Promise;
  [Symbol.toStringTag] = 'YtPlayerStateWaiter';
}

export default class YtPlayer {
  static apiReady = new Promise((resolve) => YtPlayer._apiReadyResolve = resolve);
  static init = () => {
    window.onYouTubeIframeAPIReady = () => {
      YtPlayer.playStates = {
        'unstarted': -1,
        'ended': YT.PlayerState.ENDED,
        'playing': YT.PlayerState.PLAYING,
        'paused': YT.PlayerState.PAUSED,
        'buffering': YT.PlayerState.BUFFERING,
        'cued': YT.PlayerState.CUED,
      }
      YtPlayer._apiReadyResolve();
    };
  };

  constructor(objectId) {
    this.objectId = objectId;
    this.stateWaiters = {};
    this.playerReady = new Promise((resolve) => {
      this._resolvePlayerReady = resolve;
    });
  }

  async create() {
    /* The player doesn't fetch video data when using videoId until play is called.
     * It does include the title, but not author, if used to create the iframe.
     * However, it fetches video data when using a playlist (which can be a videoId).
     * You can see this in effect by checking whether the title or author appears.
     * Calling playVideo on a player without a videoId will throw error 2.
     * This includes if you cuePlaylist and the video data hasn't been fetched yet.
     * await player.cued() after cueing a playlist to fix this. */
    await YtPlayer.apiReady;
    await this.createIframe();
  }

  createIframe() {
    if (this.player) return this.playerReady;
    /* A race setting the origin sometimes results in a postMessage error,
     * regardless of when we create it. Seems YT relies on setTimeout.*/
    /* https://earth.stanford.edu/ has embedOptOutDeprecation in ytcfg,
     * which is how they get .ytp-hide-info-bar (showinfo=0). As a workaround,
     * we overlay the thumbnail while the video is paused. If we want to wait
     * until the chrome's disappeared, await sleep(3000) after first play. */
    this.player = new YT.Player(this.objectId, {
      width: 400,
      height: 225,
      playerVars: {
        mute: 1,
        controls: 0,        /* hides channel branding */
        disablekb: 1,       /* no keyboard control */
        fs: 0,              /* no full-screen as there are no controls */
        modestbranding: 1,  /* doesn't seem to do anything */
        playsinline: 1,     /* only affects iOS */
        rel: 0,             /* only show channel videos at end */
        loop: 1,            /* only works with playlist */
        cc_load_policy: 3,  /* undocumented, disables captions */
      },
    });
    this.createListeners();
    return this.playerReady;
  }

  async load(videoId) {
    /* "Cue" a video. This replaces the current video. */
    await this.playerReady;
    /* We use a playlist to make loop work */
    await this.player.cuePlaylist(videoId);
    await this.cued();
  }

  async play() {
    /* Only errors will stop the video playing */
    // FIXME: reject if load() is called
    const state = this.player.getPlayerState();
    if (state == YT.PlayerState.PLAYING) return;
    this.player.playVideo();
    await this.playing();
  }

  async pause() {
    const state = this.player.getPlayerState();
    if (state == YT.PlayerState.PAUSED || state == YT.PlayerState.CUED) return;
    if (state != YT.PlayerState.PLAYING && state != YT.PlayerState.BUFFERING) return Promise.reject(new Error(`Cannot pause`));
    this.player.pauseVideo();
    await this.paused();
  }

  async livePause() {
    // Looks great, but pegs the CPU
    player.pauseTime = ytPlayer.player.getCurrentTime();
    await ytPlayer.play();
    player.pauseInterval = setInterval(() => ytPlayer.player.seekTo(player.pauseTime), 1000);
  }

  async mute() { this.player.mute(); }
  async unmute() { this.player.unmute(); }

  get iframe() {
    return this.player.getIframe();
  }

  createListeners() {
    for (const state in YtPlayer.playStates) {
      this.stateWaiters[state] = [];
    }

    /* One listener, to avoid races. We don't get subsequent events
     * if this doesn't return in time, so also defer it with a timer. */
    this.player.addEventListener('onStateChange', ({data}) => {
      console.log(`YtPlayer.onStateChange: ${data}`);
      setTimeout(() => {
        for (const state in YtPlayer.playStates) {
          if (data == YtPlayer.playStates[state]) {
            YtPlayerStateWaiter.resolveAll(this, state, data);
          }
        }
        // TODO: reject playing if cued or ended (or unstarted?)
      }, 0);
    });

    this.player.addEventListener('onError', ({data}) => {
      console.log(`YtPlayer.onError: ${data}`);
      setTimeout(() => {
        // TODO: check if it affects cued too
        for (const state of ['playing', 'paused', 'buffering']) {
          YtPlayerStateWaiter.rejectAll(this, state, data);
        }
      }, 0);
    });
    this.pausedOrBuffering = () => Promise.race([this.paused(), this.buffering()]);
    for (const state in YtPlayer.playStates) {
      this[state] = () => new YtPlayerStateWaiter(this, state);
    }
    /* Only fires once, can't fail */
    this.player.addEventListener('onReady', this._resolvePlayerReady);
  }
  [Symbol.toStringTag] = 'YtPlayer';
}

