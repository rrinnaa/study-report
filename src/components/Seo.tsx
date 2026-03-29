import { useEffect } from 'react'

interface SeoProps {
  title: string
  description: string
  canonicalPath: string
  noindex?: boolean
  imagePath?: string
  type?: 'website' | 'article'
  jsonLd?: Record<string, unknown>
}

function upsertMetaByName(name: string, content: string) {
  let node = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('name', name)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertMetaByProperty(property: string, content: string) {
  let node = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('property', property)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', 'canonical')
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
}

function upsertJsonLd(schema: Record<string, unknown>) {
  const scriptId = 'app-jsonld'
  let node = document.head.querySelector(`#${scriptId}`) as HTMLScriptElement | null
  if (!node) {
    node = document.createElement('script')
    node.id = scriptId
    node.type = 'application/ld+json'
    document.head.appendChild(node)
  }
  node.text = JSON.stringify(schema)
}

export default function Seo({
  title,
  description,
  canonicalPath,
  noindex = false,
  imagePath = '/social-preview.svg',
  type = 'website',
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const env = (import.meta as ImportMeta & { env?: { VITE_SITE_URL?: string } }).env
    const siteUrl = (env?.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
    const canonicalUrl = `${siteUrl}${canonicalPath}`
    const imageUrl = imagePath.startsWith('http') ? imagePath : `${siteUrl}${imagePath}`

    document.title = title
    upsertMetaByName('description', description)
    upsertMetaByName('robots', noindex ? 'noindex, nofollow' : 'index, follow')

    upsertCanonical(canonicalUrl)

    upsertMetaByProperty('og:title', title)
    upsertMetaByProperty('og:description', description)
    upsertMetaByProperty('og:type', type)
    upsertMetaByProperty('og:url', canonicalUrl)
    upsertMetaByProperty('og:image', imageUrl)

    if (jsonLd) {
      upsertJsonLd(jsonLd)
      return
    }

    const jsonLdNode = document.head.querySelector('#app-jsonld')
    if (jsonLdNode) {
      jsonLdNode.remove()
    }
  }, [title, description, canonicalPath, noindex, imagePath, type, jsonLd])

  return null
}
