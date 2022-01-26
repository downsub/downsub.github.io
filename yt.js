import {ttmlToSrt, ttmlToText} from './subs.js';

export const getVideoId = (url) => {
  const res = [
    new RegExp('^(https?://)?youtu\\.be/(?<id>[A-Za-z0-9_-]+)'),
    new RegExp('^(https?://)?(www\\.|m.)?(youtube|googlevideo|youtube-nocookie)\\.com/(embed/|v/|.*\\?v=|.*\\&v=)(?<id>[A-Za-z0-9_-]+)'),
  ];
  for (const re of res) {
    const match = url.match(re);
    if (match) return match.groups.id;
  }
};

export const getThumbnail = async (id) => {
  const img = new Image();
  img.src = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  await img.decode();
  if (img.width == 120) {
    /* We got a 404, use the guaranteed thumbnail instead */
    return `url(https://img.youtube.com/vi/${id}/hqdefault.jpg)`;
  } else {
    return `url(${img.src})`;
  }
};

export const getCaptionList = async (id) => {
  const url = `https://europe-west2-youtube-transcript-api-339100.cloudfunctions.net/youtube_transcript_api?video_id=${id}`
//  const url = `captionlist-${id}.json`;
  const resp = await fetch(url);
  return await resp.json();
};

const getCaptions = async (baseUrl, format) => {
  const url = `${baseUrl}&fmt=${format}`;
//  const url = `caption-${format}-mock.json`;
  const resp = await fetch(url);
  return await resp.text();
};

export const getCaptionsInFormat = async (baseUrl, format) => {
  if (format == 'srt') {
    const captions = await getCaptions(baseUrl, 'ttml');
    return ttmlToSrt(captions);
  } else if (format == 'txt') {
    const captions = await getCaptions(baseUrl, 'ttml');
    return ttmlToText(captions);
  }
  return getCaptions(baseUrl, format);
};
