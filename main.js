import YtPlayer from './ytplayer.js';
import * as Yt from './yt.js'
import Dropdown from './dropdown.js';
import {parseTtml} from './subs.js';

(() => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const setState = (state) => {
      if (!['state-start', 'state-langs-loaded'].includes(state)) error(`Invalid state`)
      document.body.classList.remove('state-loading');
      document.body.classList.remove('state-start');
      document.body.classList.remove('state-langs-loaded');
      document.body.classList.add(state);
  }
  const setUrlParams = (params) => {
    const searchParams = new URL(document.location).searchParams;
    for (const k in params) {
      searchParams.set(k, params[k]);
    }
    history.pushState({}, '', '?' + searchParams);
  };

  const error = (msg) => {
      langDropdown.clearOptions();
      setState('state-start');
      setTimeout(() => alert(msg), 200);
      throw msg;
  };

  const listCaptions = async () => {
    const url = document.querySelector('input[name="url"]').value.trim();
    if (!url) {
      langDropdown.clearOptions();
      setState('state-start');
      setUrlParams({url});
      return;
    };

    const id = Yt.getVideoId(url);
    if (!id) error(`Could not recognise this as a YouTube URL`);
    setUrlParams({url});
    const captionInfo = await Yt.getCaptionList(id);
    if (!captionInfo) error(`Could not find any captions for this video`);

    const languageCode = searchParams.get('lang');
    let langIndex;

    const defaultTrack = captionInfo?.audioTracks?.[0]?.defaultCaptionTrackIndex;
    const options = [];
    for (const [index, track] of captionInfo.captionTracks.entries()) {
      options.push([index, track.name?.simpleText, {
        languageCode: track.languageCode,
        baseUrl: track.baseUrl,
      }]);
      if (track.languageCode == languageCode) langIndex = index;
    }
    langDropdown.setOptions(options);
    langDropdown.index = defaultTrack;

    // FIXME: put this in localStorage
    if (langIndex == null) langIndex = defaultTrack;
    // FIXME: try English
    if (langIndex == null) langIndex = 0;
    // FIXME: store and use track as a hint in case there are multiple of the same language

    setState('state-langs-loaded');
    window.currentYoutubeId = id;

    Yt.getThumbnail(id).then((url) => {
      if (window.currentYoutubeId != id) return;
      document.querySelector('#thumbnail').style.backgroundImage = url;
    });
    loadVideo(id);

    viewCaptions();
  };

  const viewCaptions = async () => {
    const lang = document.querySelector('#lang');
    const baseUrl = lang.dataset.baseUrl;
    const languageCode = lang.dataset.languageCode;

    const ttml = await Yt.getCaptionsInFormat(baseUrl, 'ttml');
    const cues = parseTtml(ttml);
    const captions = document.querySelector('#captions');
    captions.innerText = '';
    let lastEndMs = 0;
    for (const cue of cues) {
      const span = document.createElement('span');
      span.innerText = (cue.text + ' ').replace(/\s+/g, ' ');
      const beginMs = Date.parse(`1970-01-01T${cue.begin}Z`);
      const endMs = Date.parse(`1970-01-01T${cue.end}Z`);
      if (lastEndMs) {
        if (beginMs - lastEndMs > 1000) {
          captions.appendChild(document.createElement('br'));
          captions.appendChild(document.createElement('br'));
        } else if (cue.text.startsWith('- ')) {
          captions.appendChild(document.createElement('br'));
          captions.appendChild(document.createElement('br'));
        } else if (cue.text[0] == cue.text[0].toUpperCase) {
          captions.appendChild(document.createElement('br'));
        }
      }
      span.dataset.beginMs = beginMs;
      span.dataset.endMs = endMs;
      captions.appendChild(span);
      lastEndMs = endMs;
    }
  };

  const downloadCaptions = async () => {
    const lang = document.querySelector('#lang');
    const baseUrl = lang.dataset.baseUrl;
    const languageCode = lang.dataset.languageCode;
    const name = lang.querySelector(':scope > label').innerText;
    const format = document.querySelector('input[name="format"]:checked').value;
    const id = window.currentYoutubeId;
    const captions = await Yt.getCaptionsInFormat(baseUrl, format);
    const blob = new Blob([captions], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let title;
    if (document.querySelector('.player').classList.contains('player-ready')) {
      /* The browser should deal with invalid characters */
      title = ytPlayer.player.getVideoData().title;
    }
    if (!title) title = id;
    if (name) {
      a.download = `${title}.${name}.${format}`;
    } else {
      a.download = `${title}.${languageCode}.${format}`;
    }
    a.click();
  };

  const loadVideo = async (id) => {
    document.querySelector('.player').classList.remove('player-ready');
    document.querySelector('.player').classList.add('player-not-ready');

    await ytPlayer.load(id);
    if (false) {
      // Duration is only populated when we try to play
      await ytPlayer.play();
      await ytPlayer.pause();
      console.log(ytPlayer.player.getDuration());
    }
    ytPlayer.player.addEventListener('onStateChange', ({data}) => {
      document.querySelector('.player').classList.toggle('player-playing', data == YT.PlayerState.PLAYING);
    });
    document.querySelector('.player').classList.remove('player-not-ready');
    document.querySelector('.player').classList.add('player-ready');
  };

  document.querySelector('#format').addEventListener('click', ({target}) => {
    if (!target.matches('input[name="format"]')) return;
    const format = document.querySelector('input[name="format"]:checked').value;
    // FIXME: store this in localstorage instead
    setUrlParams({format});
  });
  document.querySelector('#lang').addEventListener('change', ({target}) => {
    setUrlParams({lang: document.querySelector('#lang').dataset.languageCode});
    viewCaptions();
  });
  document.querySelector('form').addEventListener('submit', (e) => {
    console.log(e);
    if (e.submitter.value == 'Check') {
      listCaptions();
      // TODO: show captions below as well
    } else {
      downloadCaptions();
    }
    e.preventDefault();
    return false;
  });


  YtPlayer.init();
  window.ytPlayer = new YtPlayer('player-iframe');
  window.ytPlayer.create();

  /*
  player.addEventListener('onPlaybackRateChange', ({data}) => {
    console.log(`onPlaybackRateChange: ${data}`);
  });
  player.addEventListener('onApiChange', ({data}) => {
    console.log(`onApiChange: ${data}`);
  });
  */

  const searchParams = new URL(document.location).searchParams;

  let format = searchParams.get('format');
  if (!format) format = 'srt';
  if (!format.match(/^[a-z0-9]+$/)) format = 'srt';
  document.querySelector('input[name="format"][value="' + format + '"]').checked = true;

  const url = searchParams.get('url');
  if (url) {
    document.querySelector('input[name="url"]').value = url;
    listCaptions();
  } else {
    setState('state-start');
  }
  document.querySelector('input[name="url"]').focus();

  window.langDropdown = new Dropdown('lang');

})();
