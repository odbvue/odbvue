// Process @[youtube](youtubeVideoID)
// Process @[vimeo](vimeoVideoID)
// Process @[vine](vineVideoID)
// Process @[prezi](preziID)
// Process @[osf](guid)

interface VideoOptions {
  [key: string]: unknown
  url: (service: string, videoID: string, url: string, options: VideoOptions) => string
  youtube: {
    width: string
    height: string
    nocookie: boolean
    parameters?: { [key: string]: string }
  }
  vimeo: {
    width: number
    height: number
  }
  vine: {
    width: number
    height: number
    embed: string
  }
  prezi: {
    width: number
    height: number
  }
  osf: {
    width: string
    height: string
  }
}

interface MarkdownIt {
  helpers: {
    parseLinkLabel: (state: State, start: number, disableNested: boolean) => number
  }
  utils: {
    escapeHtml: (str: string) => string
  }
  renderer: {
    rules: { [key: string]: (md: MarkdownIt, options: VideoOptions) => (tokens: Token[], idx: number) => string }
  }
  inline: {
    ruler: {
      before: (beforeName: string, ruleName: string, rule: (state: State, silent: boolean) => boolean) => void
    }
    State: new (service: string, md: MarkdownIt, env: unknown, tokens: Token[]) => State
    tokenize: (state: State) => void
  }
}

interface State {
  src: string
  pos: number
  level: number
  md: MarkdownIt
  env: unknown
  service?: string
  push: (type: string, tag: string) => Token
}

interface Token {
  videoID: string
  service: string
  url: string
  level: number
}

const ytRegex = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
function youtubeParser(url: string): string {
  const match = url.match(ytRegex)
  return match && match[7].length === 11 ? match[7] : url
}

const vimeoRegex =
  /https?:\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/

function vimeoParser(url: string): string {
  const match = url.match(vimeoRegex)
  return match && typeof match[3] === 'string' ? match[3] : url
}

const vineRegex = /^http(?:s?):\/\/(?:www\.)?vine\.co\/v\/([a-zA-Z0-9]{1,13}).*/
function vineParser(url: string): string {
  const match = url.match(vineRegex)
  return match && match[1].length === 11 ? match[1] : url
}

const preziRegex = /^https:\/\/prezi.com\/(.[^/]+)/
function preziParser(url: string): string {
  const match = url.match(preziRegex)
  return match ? match[1] : url
}

// TODO: Write regex for staging and local servers.
const mfrRegex =
  /^http(?:s?):\/\/(?:www\.)?mfr\.osf\.io\/render\?url=http(?:s?):\/\/osf\.io\/([a-zA-Z0-9]{1,5})\/\?action=download/
function mfrParser(url: string): string {
  const match = url.match(mfrRegex)
  return match ? match[1] : url
}

const EMBED_REGEX = /@\[([a-zA-Z].+)]\([\s]*(.*?)[\s]*[)]/im

function videoEmbed(md: MarkdownIt, options: VideoOptions) {
  function videoReturn(state: State, silent: boolean): boolean {
    let token
    let videoID
    const theState = state
    const oldPos = state.pos

    if (
      state.src.charCodeAt(oldPos) !== 0x40 /* @ */ ||
      state.src.charCodeAt(oldPos + 1) !== 0x5b /* [ */
    ) {
      return false
    }

    const match = EMBED_REGEX.exec(state.src.slice(state.pos, state.src.length))

    if (!match || match.length < 3) {
      return false
    }

    const service = match[1]
    videoID = match[2]
    const serviceLower = service.toLowerCase()

    if (serviceLower === 'youtube') {
      videoID = youtubeParser(videoID)
    } else if (serviceLower === 'vimeo') {
      videoID = vimeoParser(videoID)
    } else if (serviceLower === 'vine') {
      videoID = vineParser(videoID)
    } else if (serviceLower === 'prezi') {
      videoID = preziParser(videoID)
    } else if (serviceLower === 'osf') {
      videoID = mfrParser(videoID)
    } else if (!options[serviceLower]) {
      return false
    }

    // If the videoID field is empty, regex currently make it the close parenthesis.
    if (videoID === ')') {
      videoID = ''
    }

    const serviceStart = oldPos + 2
    const serviceEnd = md.helpers.parseLinkLabel(state, oldPos + 1, false)

    //
    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    //
    if (!silent) {
      theState.pos = serviceStart
      theState.service = theState.src.slice(serviceStart, serviceEnd)
      const newState = new theState.md.inline.State(service, theState.md, theState.env, [])
      newState.md.inline.tokenize(newState)

      token = theState.push('video', '')
      token.videoID = videoID
      token.service = service
      token.url = match[2]
      token.level = theState.level
    }

    theState.pos += theState.src.indexOf(')', theState.pos)
    return true
  }

  return videoReturn
}

function extractVideoParameters(url: string): Map<string, string> {
  const parameterMap = new Map<string, string>()
  const params = url.replace(/&amp;/gi, '&').split(/[#?&]/)

  if (params.length > 1) {
    for (let i = 1; i < params.length; i += 1) {
      const keyValue = params[i].split('=')
      if (keyValue.length > 1) parameterMap.set(keyValue[0], keyValue[1])
    }
  }

  return parameterMap
}

function videoUrl(service: string, videoID: string, url: string, options: VideoOptions): string {
  switch (service) {
    case 'youtube': {
      const parameters = extractVideoParameters(url)
      if (options.youtube.parameters) {
        Object.keys(options.youtube.parameters).forEach((key) => {
          parameters.set(key, options.youtube.parameters![key] as string)
        })
      }

      // Start time parameter can have the format t=0m10s or t=<time_in_seconds> in share URLs,
      // but in embed URLs the parameter must be called 'start' and time must be in seconds
      const timeParameter = parameters.get('t')
      if (timeParameter !== undefined) {
        let startTime = 0
        const timeParts = timeParameter.match(/[0-9]+/g)
        let j = 0

        if (timeParts) {
          while (timeParts.length > 0) {
            startTime += Number(timeParts.pop()) * Math.pow(60, j)

            j += 1
          }
        }
        parameters.set('start', startTime.toString())
        parameters.delete('t')
      }

      parameters.delete('v')
      parameters.delete('feature')
      parameters.delete('origin')

      const parameterArray = Array.from(parameters, (p) => p.join('='))
      const parameterPos = videoID.indexOf('?')

      let finalUrl = 'https://www.youtube'
      if (options.youtube.nocookie || url.indexOf('youtube-nocookie.com') > -1)
        finalUrl += '-nocookie'
      finalUrl += '.com/embed/' + (parameterPos > -1 ? videoID.substr(0, parameterPos) : videoID)
      if (parameterArray.length > 0) finalUrl += '?' + parameterArray.join('&')
      return finalUrl
    }
    case 'vimeo':
      return 'https://player.vimeo.com/video/' + videoID
    case 'vine':
      return 'https://vine.co/v/' + videoID + '/embed/' + options.vine.embed
    case 'prezi':
      return (
        'https://prezi.com/embed/' +
        videoID +
        '/?bgcolor=ffffff&amp;lock_to_path=0&amp;autoplay=0&amp;autohide_ctrls=0&amp;' +
        'landing_data=bHVZZmNaNDBIWnNjdEVENDRhZDFNZGNIUE43MHdLNWpsdFJLb2ZHanI5N1lQVHkxSHFxazZ0UUNCRHloSXZROHh3PT0&amp;' +
        'landing_sign=1kD6c0N6aYpMUS0wxnQjxzSqZlEB8qNFdxtdjYhwSuI'
      )
    case 'osf':
      return 'https://mfr.osf.io/render?url=https://osf.io/' + videoID + '/?action=download'
    default:
      return service
  }
}

function tokenizeVideo(md: MarkdownIt, options: VideoOptions) {
  function tokenizeReturn(tokens: Token[], idx: number): string {
    const videoID = md.utils.escapeHtml(tokens[idx].videoID)
    const service = md.utils.escapeHtml(tokens[idx].service).toLowerCase()
    const checkUrl =
      /http(?:s?):\/\/(?:www\.)?[a-zA-Z0-9-:.]{1,}\/render(?:\/)?[a-zA-Z0-9.&;?=:%]{1,}url=http(?:s?):\/\/[a-zA-Z0-9 -:.]{1,}\/[a-zA-Z0-9]{1,5}\/\?[a-zA-Z0-9.=:%]{1,}/
    let num

    if (service === 'osf' && videoID) {
      num = Math.random() * 0x10000

      if (videoID.match(checkUrl)) {
        return (
          '<div id="' +
          num +
          '" class="mfr mfr-file"></div><script>' +
          '$(document).ready(function () {new mfr.Render("' +
          num +
          '", "' +
          videoID +
          '");' +
          '    }); </script>'
        )
      }
      return (
        '<div id="' +
        num +
        '" class="mfr mfr-file"></div><script>' +
        '$(document).ready(function () {new mfr.Render("' +
        num +
        '", "https://mfr.osf.io/' +
        'render?url=https://osf.io/' +
        videoID +
        '/?action=download%26mode=render");' +
        '    }); </script>'
      )
    }

    return videoID === ''
      ? ''
      : '<iframe class="' +
          service +
          '-player" type="text/html" width="' +
          options[service].width +
          '" height="' +
          options[service].height +
          '" style="aspect-ratio: 16/9; width: 100%; max-width: 100%; border: 0; display: block; margin: 1em auto;" src="' +
          options.url(service, videoID, tokens[idx].url, options) +
          '"></iframe>'
  }

  return tokenizeReturn
}

const defaults: VideoOptions = {
  url: videoUrl,
  youtube: { width: '100%', height: '100%', nocookie: false },
  vimeo: { width: 500, height: 281 },
  vine: { width: 600, height: 600, embed: 'simple' },
  prezi: { width: 550, height: 400 },
  osf: { width: '100%', height: '100%' },
}

export default function (md: MarkdownIt, options?: Partial<VideoOptions>) {
  const theOptions: VideoOptions = { ...defaults }
  const theMd = md
  if (options) {
    Object.keys(options).forEach(function checkForKeys(key) {
      if (typeof (options as Record<string, unknown>)[key] !== 'undefined') {
        ;(theOptions as Record<string, unknown>)[key] = (options as Record<string, unknown>)[key]
      }
    })
  }
  theMd.renderer.rules.video = tokenizeVideo(theMd, theOptions)
  theMd.inline.ruler.before('emphasis', 'video', videoEmbed(theMd, theOptions))
}
