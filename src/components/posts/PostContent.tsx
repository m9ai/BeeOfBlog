'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface PostContentProps {
  content: string | null
}

export function PostContent({ content }: PostContentProps) {
  if (!content) {
    return (
      <div className="text-muted-foreground italic">
        暂无内容
      </div>
    )
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-base leading-relaxed mb-4 text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 space-y-2 text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="ml-4">{children}</li>
        ),
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || '')
          return match ? (
            <pre className="bg-secondary/80 rounded-lg my-4 p-4 overflow-x-auto">
              <code className="text-sm font-mono">
                {String(children).replace(/\n$/, '')}
              </code>
            </pre>
          ) : (
            <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          )
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt}
            className="rounded-lg my-4 max-w-full h-auto"
          />
        ),
        hr: () => <hr className="my-8 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
