export default class YtApi {
  static apiReady = new Promise((resolve) => this._apiReadyResolve = resolve);
  static keyUrl = 'https://europe-west2-youtube-transcript-api-339100.cloudfunctions.net/personal_api_key';
  static async init() {
    fetch(this.keyUrl).then(async (resp) => {
      this.key = await resp.text();
      this._apiReadyResolve();
    });
  }

  static async getVideoSnippet(id, languageCode) {
    await this.apiReady;
    const url = `https://youtube.googleapis.com/youtube/v3/videos?part=snippet&hl=${languageCode}&id=${id}&key=${this.key}`;
    const resp = await fetch(url);
    const json = await resp.json();
    return json?.items?.[0]?.snippet;
  };
}
