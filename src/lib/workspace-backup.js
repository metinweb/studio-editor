import { repository } from './database'
import { cleanHtml } from './content'
import { archiveLimit, encodeArchive, decodeArchive } from './archive-format'
import { normalizeTags } from './document-library'

export async function downloadBackup() {
  const text = await encodeArchive(await repository.snapshot())
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `studio-${new Date().toISOString().slice(0, 10)}.studio.json`,
  })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function prepareBackup(file) {
  if (file.size > archiveLimit) throw new Error('Yedek en fazla 100 MB olabilir.')
  const data = await decodeArchive(await file.text())
  const ids = new Map(data.documents.map((d) => [d.id, crypto.randomUUID()]))
  const mediaIds = new Map(data.media.map((m) => [m.id, crypto.randomUUID()]))
  const content = (html) => {
    const template = document.createElement('template')
    template.innerHTML = cleanHtml(html)
    for (const node of template.content.querySelectorAll('[data-studio-asset]')) {
      const id = mediaIds.get(node.dataset.studioAsset)
      if (id) node.dataset.studioAsset = id
    }
    return template.innerHTML
  }
  return {
    documents: data.documents.map((d) => ({
      id: ids.get(d.id),
      title: d.title,
      locale: d.locale,
      content: content(d.content),
      blockIds: d.blockIds || [],
      updatedAt: d.updatedAt,
      favorite: d.favorite === true,
      tags: normalizeTags(d.tags),
    })),
    media: data.media.map((m) => ({
      id: mediaIds.get(m.id),
      name: m.name,
      type: m.type,
      size: m.size,
      dataUrl: m.dataUrl,
      alt: m.alt,
      createdAt: m.createdAt,
    })),
    templates: data.templates.map((t) => ({
      id: crypto.randomUUID(),
      name: t.name,
      html: content(t.html),
      createdAt: t.createdAt,
    })),
    versions: data.versions.map((v) => ({
      id: crypto.randomUUID(),
      documentId: ids.get(v.documentId),
      title: v.title,
      locale: v.locale,
      content: content(v.content),
      blockIds: v.blockIds || [],
      createdAt: v.createdAt,
      reason: v.reason,
    })),
  }
}
