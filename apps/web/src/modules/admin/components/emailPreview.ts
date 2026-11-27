export function emailPreviewDocument(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content
    .querySelectorAll('script, iframe, object, embed, form, link, base, meta')
    .forEach((el) => el.remove())
  template.content.querySelectorAll('a, area').forEach((el) => {
    el.removeAttribute('href')
    el.removeAttribute('xlink:href')
  })
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"></head><body>${template.innerHTML}</body></html>`
}
