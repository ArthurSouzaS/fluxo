import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './Markdown.module.scss';

/** Destaca @menções transformando-as em links internos (renderizados como etiqueta). */
function highlightMentions(text: string) {
  return text.replace(
    /(^|[^\w@.`])@([a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?)/gi,
    '$1[@$2](#mention-$2)',
  );
}

/**
 * Renderiza Markdown com segurança: HTML cru é ignorado (sem rehype-raw)
 * e links externos abrem em nova aba sem acesso ao `window.opener`.
 */
export function Markdown({ children, mentions }: { children: string; mentions?: boolean }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: content }) =>
            href?.startsWith('#mention-') ? (
              <span className={styles.mention}>{content}</span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {content}
              </a>
            ),
          img: ({ alt }) => <span className={styles.image}>[imagem: {alt}]</span>,
          input: ({ checked }) => <input type="checkbox" checked={checked} readOnly disabled />,
        }}
      >
        {mentions ? highlightMentions(children) : children}
      </ReactMarkdown>
    </div>
  );
}
