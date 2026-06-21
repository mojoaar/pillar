import { readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, ChevronRight, FileText, ArrowRight } from 'lucide-react';

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

// Curated sidebar navigation links for our documentation chapters
const chapters = [
  { title: 'Getting Started', slug: 'getting-started', href: '/docs' },
  { title: 'SSH Key Auth', slug: 'ssh-keys', href: '/docs/ssh-keys' },
  { title: 'MFA TOTP Guide', slug: 'mfa-setup', href: '/docs/mfa-setup' },
  { title: 'Administration', slug: 'admin-guide', href: '/docs/admin-guide' },
];

/**
 * Custom, lightweight, Edge-safe Markdown-to-React elements parser.
 * This completely avoids bulky NPM bundles like remark/rehype, resulting in 
 * instant rendering and zero edge-compatibility compilation hazards.
 */
function renderMarkdown(content: string) {
  const lines = content.split('\n');
  const elements: React.JSX.Element[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let keyCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks (e.g. ```bash ... ```)
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        inCodeBlock = false;
        elements.push(
          <pre 
            key={`code-${keyCounter++}`} 
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: '1rem',
              overflowX: 'auto',
              fontFamily: 'var(--terminal-font)',
              fontSize: '0.85rem',
              color: 'var(--accent)',
              marginBottom: '1.25rem',
              lineHeight: '1.5'
            }}
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
      } else {
        // Open code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Handle Headers (#, ##, ###)
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${keyCounter++}`} style={{ fontSize: '2rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.5rem', marginTop: '1.5rem', color: 'var(--text-primary)' }}>
          {parseInline(line.substring(2))}
        </h1>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${keyCounter++}`} style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--text-primary)' }}>
          {parseInline(line.substring(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${keyCounter++}`} style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem', marginTop: '1.25rem', color: 'var(--text-primary)' }}>
          {parseInline(line.substring(4))}
        </h3>
      );
      continue;
    }

    // Handle Unordered Lists (- item)
    if (line.startsWith('- ')) {
      elements.push(
        <li 
          key={`li-${keyCounter++}`} 
          style={{ 
            marginLeft: '1.5rem', 
            marginBottom: '0.5rem', 
            listStyleType: 'disc', 
            fontSize: '0.95rem',
            lineHeight: '1.5',
            color: 'var(--text-primary)'
          }}
        >
          {parseInline(line.substring(2))}
        </li>
      );
      continue;
    }

    // Handle Ordered Lists (1. item)
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      const text = match ? match[2] : line;
      elements.push(
        <li 
          key={`ol-${keyCounter++}`} 
          style={{ 
            marginLeft: '1.5rem', 
            marginBottom: '0.5rem', 
            listStyleType: 'decimal', 
            fontSize: '0.95rem',
            lineHeight: '1.5',
            color: 'var(--text-primary)'
          }}
        >
          {parseInline(text)}
        </li>
      );
      continue;
    }

    // Handle horizontal rules (---)
    if (line.trim() === '---') {
      elements.push(
        <hr key={`hr-${keyCounter++}`} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2rem 0' }} />
      );
      continue;
    }

    // Handle blank lines
    if (line.trim() === '') {
      continue;
    }

    // Handle regular Paragraphs
    elements.push(
      <p 
        key={`p-${keyCounter++}`} 
        style={{ 
          fontSize: '0.975rem', 
          lineHeight: '1.6', 
          marginBottom: '1.25rem', 
          color: 'var(--text-primary)' 
        }}
      >
        {parseInline(line)}
      </p>
    );
  }

  return elements;
}

/**
 * Parse simple inline markdown formatting like bold (**bold**) and inline code (`code`)
 */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let index = 0;
  let keyCounter = 0;

  // Regex to match **bold** or `code` or [text](href)
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
  const matches = text.split(regex);

  return matches.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`bold-${keyCounter++}`}>{part.substring(2, part.length - 2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={`inline-code-${keyCounter++}`} 
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.15rem 0.3rem',
            fontFamily: 'var(--terminal-font)',
            fontSize: '0.85rem',
            color: 'var(--accent)'
          }}
        >
          {part.substring(1, part.length - 1)}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <Link 
            key={`link-${keyCounter++}`} 
            href={match[2]} 
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            {match[1]}
          </Link>
        );
      }
    }
    return part;
  });
}

export default async function DocsPage({ params }: DocsPageProps) {
  // Await Next.js 15+ promised parameters (Gotcha #1 / #26)
  const resolvedParams = await params;
  const slugArray = resolvedParams.slug;
  
  // Gotcha check: enforce extreme safety against directory traversal attacks
  // Strip any dots or slash patterns, allowing only safe alphanumeric paths
  const cleanSlug = slugArray && slugArray.length > 0 
    ? slugArray.join('/').replace(/[^a-zA-Z0-9_-]/g, '') 
    : 'getting-started';

  // Gotcha #28: Use process.cwd() instead of __dirname inside Turbopack
  const filepath = path.join(process.cwd(), 'docs', 'content', `${cleanSlug}.md`);

  let fileContent = '';
  try {
    fileContent = await readFile(filepath, 'utf8');
  } catch (err) {
    // If markdown file is not found, render Next.js notFound handler
    notFound();
  }

  // Determine current, previous, and next chapters for footers
  const currentIdx = chapters.findIndex((c) => c.slug === cleanSlug || (cleanSlug === 'getting-started' && c.slug === 'getting-started'));
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;

  return (
    <div style={{
      display: 'flex',
      gap: '2.5rem',
      height: 'calc(100vh - 120px)',
      width: '100%'
    }}>
      {/* Sidebar Chapters Guide */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '1.25rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        height: '100%',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
          <BookOpen size={18} />
          <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chapters</strong>
        </div>
        
        {chapters.map((ch) => {
          const isCurrent = ch.slug === cleanSlug || (cleanSlug === 'getting-started' && ch.slug === 'getting-started');
          return (
            <Link
              key={ch.slug}
              href={ch.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                fontSize: '0.9rem',
                borderRadius: 'var(--border-radius)',
                textDecoration: 'none',
                color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
                backgroundColor: isCurrent ? 'var(--bg-tertiary)' : 'transparent',
                fontWeight: isCurrent ? 600 : 500,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} />
                <span>{ch.title}</span>
              </span>
              {isCurrent && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </aside>

      {/* Main Documentation Viewer Column */}
      <article style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '2.5rem 3rem',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1 }}>
          {renderMarkdown(fileContent)}
        </div>

        {/* Footer Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)'
        }}>
          {prevChapter ? (
            <Link href={prevChapter.href} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
              <span>← {prevChapter.title}</span>
            </Link>
          ) : <div />}

          {nextChapter && (
            <Link href={nextChapter.href} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
              <span>{nextChapter.title} →</span>
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
