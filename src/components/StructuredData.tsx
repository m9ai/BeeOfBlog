import Script from 'next/script'

export function StructuredData() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "洋泾小蜜蜂",
    "url": process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com",
    "description": "专注洋泾社区服务，提供便民信息、社区活动、邻里互助等服务",
    "publisher": {
      "@type": "Organization",
      "name": "洋泾小蜜蜂",
      "logo": {
        "@type": "ImageObject",
        "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com"}/logo.png`
      }
    },
    "inLanguage": "zh-CN",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com"}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <Script
      id="website-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(websiteData)
      }}
    />
  )
}