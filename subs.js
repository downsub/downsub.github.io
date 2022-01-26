const getTtmlText = (parent) => {
  let text = '';
  for (const node of parent.childNodes) {
    // TODO: styles? deduping of shadows? comments?
    if (node.nodeName == '#text') {
      text += node.data;
    } else if (node.nodeName == 'br') {
      text += '\n';
    } else if (node.nodeName == 'span') {
      text += getTtmlText(node);
    }
  }
  return text;
};

export const parseTtml = (ttml) => {
    const doc = new DOMParser().parseFromString(ttml, 'application/xml');
    const cues = [];
    for (const cue of doc.querySelectorAll('tt > body > div > p')) {
      const begin = cue.getAttribute('begin');
      const end = cue.getAttribute('end');
      const text = getTtmlText(cue);
      cues.push({begin, end, text});
    }
    return cues;
};

export const ttmlToSrt = (ttml) => {
    // TODO: inline formatting? regions? karaoke?
    const cues = parseTtml(ttml);
    const lines = [];
    let n = 1;
    /* Aegi parses '<b', '<i', etc as formatting, but doesn't escape when
     * exporting, so as the next best option, let's follow WebVTT's lead:
     * https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API#cue_payload */
    const escapeFormatting = (str) => str.replace(/[&<>]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
      }[tag]));
    for (const cue of cues) {
      const begin = cue.begin.replace('.', ',');
      const end = cue.end.replace('.', ',');
      /* \u{200b} is a placeholder to keep from breaking to the next cue */
      const text = cue.text.replace('\n\n', '\n\u{200b}\n');
      lines.push(`${n}`);
      lines.push(`${begin} --> ${end}`);
      /* To ensure round-tripping and to match other download sites,
       * we don't perform escaping. Treat Aegi as buggy here. */
      //lines.push(`${escapeFormatting(text)}`);
      lines.push(`${text}`);
      lines.push(``);
      n += 1;
    }
    return lines.join('\n');
};

export const ttmlToText = (ttml) => {
    const cues = parseTtml(ttml);
    const lines = [];
    for (const cue of cues) {
      lines.push(cue.text);
    }
    return lines.join('\n');
};

