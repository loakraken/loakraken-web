// A 개발자 노트 body drawn from its parsed markdown (lib/dev-notes/model):
// React elements only, so nothing in a note is ever HTML.
import Link from "next/link";
import { parseMarkdown, type Block, type Inline } from "@/lib/dev-notes/model";
import { EmailLink } from "@/components/ui/email-link";
import styles from "./dev-notes.module.css";

function Inlines({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    if (part.t === "text") return part.v;
    if (part.t === "code") return <code key={i}>{part.v}</code>;
    if (part.t === "email") return <EmailLink key={i} address={part.v} />;
    if (part.t === "strong")
      return (
        <strong key={i}>
          <Inlines parts={part.c} />
        </strong>
      );
    // Paths on this site stay in the app; web addresses open beside it.
    return part.href.startsWith("/") ? (
      <Link key={i} href={part.href}>
        <Inlines parts={part.c} />
      </Link>
    ) : (
      <a key={i} href={part.href} target="_blank" rel="noreferrer">
        <Inlines parts={part.c} />
        <span className="sr-only"> (새 창)</span>
      </a>
    );
  });
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "h2":
      return (
        <h2>
          <Inlines parts={block.c} />
        </h2>
      );
    case "h3":
      return (
        <h3>
          <Inlines parts={block.c} />
        </h3>
      );
    case "p":
      return (
        <p>
          <Inlines parts={block.c} />
        </p>
      );
    case "quote":
      return (
        <blockquote>
          <Inlines parts={block.c} />
        </blockquote>
      );
    case "hr":
      return <hr />;
    case "ul":
    case "ol": {
      const List = block.t;
      return (
        <List>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines parts={item.c} />
              {item.sub && (
                <ul>
                  {item.sub.map((child, n) => (
                    <li key={n}>
                      <Inlines parts={child} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </List>
      );
    }
    case "table":
      // Wide tables scroll inside their own box on a phone, never the page.
      return (
        <div className={styles.tableWrap} role="region" aria-label="가로로 넘겨 보는 표" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    <Inlines parts={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i}>
                      <Inlines parts={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function DevNoteBody({ body }: { body: string }) {
  return (
    <div className={styles.body}>
      {parseMarkdown(body).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
