import type { V2Image, V2Resolvers } from "./types";
import { Img, RichText } from "./parts";

/**
 * Document-style blog page. The body follows the owner-provided source pages
 * (a press release and a company knowledge base): a plain editorial column,
 * bordered title block, facts callout, data tables and a contact block. Only
 * the body styling is local to `.bdoc`; the site's own header and footer stay
 * in place. Colours come from the source pages, so the article surface is a
 * light sheet inside the dark storefront shell.
 */

type DocumentBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "facts"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "contact"; items: string[] };

export type DocumentData = {
  variant: "press" | "knowledge";
  kicker?: string;
  h1: string;
  byline?: string;
  cover?: V2Image;
  lead?: string;
  sections: { h2: string; blocks: DocumentBlock[] }[];
  facts?: string[];
  contacts?: string[];
  footerNote?: string;
};

function Block({ block, r }: { block: DocumentBlock; r: V2Resolvers }) {
  if (block.kind === "p") return <p><RichText r={r} text={block.text} /></p>;
  if (block.kind === "h3") return <h3>{block.text}</h3>;
  if (block.kind === "h4") return <h4>{block.text}</h4>;
  if (block.kind === "quote") return <blockquote><p><RichText r={r} text={block.text} /></p></blockquote>;
  if (block.kind === "list") {
    const items = block.items.map((item) => <li key={item}><RichText r={r} text={item} /></li>);
    return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
  }
  if (block.kind === "facts") {
    return (
      <div className="bdoc-facts">
        <ul>
          {block.items.map((item) => <li key={item}><RichText r={r} text={item} /></li>)}
        </ul>
      </div>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="bdoc-table">
        <table>
          <thead>
            <tr>{block.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => (
                  <td key={`${index}:${cell}`}><RichText r={r} text={cell} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="bdoc-contact">
      {block.items.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}
    </div>
  );
}

export function BlogDocumentPage({ data, r }: { data: DocumentData; r: V2Resolvers }) {
  return (
    <div className={`bdoc${data.variant === "knowledge" ? " bdoc-kb" : " bdoc-press"}`}>
      <style dangerouslySetInnerHTML={{ __html: BDOC_CSS }} />
      <div className="bdoc-wrap">
        <header className="bdoc-head">
          {data.kicker ? <p className="bdoc-kicker">{data.kicker}</p> : null}
          <h1>{data.h1}</h1>
          {data.byline ? <p>{data.byline}</p> : null}
        </header>

        {data.cover ? (
          <figure className="bdoc-cover">
            <Img eager image={data.cover} r={r} />
          </figure>
        ) : null}

        {data.lead ? <p className="bdoc-lead"><RichText r={r} text={data.lead} /></p> : null}

        {data.sections.map((section) => (
          <section key={section.h2}>
            <h2>{section.h2}</h2>
            {section.blocks.map((block, index) => <Block block={block} key={`${section.h2}:${index}`} r={r} />)}
          </section>
        ))}

        {data.facts?.length ? (
          <div className="bdoc-facts">
            {data.facts.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}
          </div>
        ) : null}

        {data.contacts?.length ? (
          <div className="bdoc-contact">
            {data.contacts.map((item) => <p key={item}><RichText r={r} text={item} /></p>)}
          </div>
        ) : null}

        {data.footerNote ? (
          <footer className="bdoc-footer">
            <p><RichText r={r} text={data.footerNote} /></p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

const BDOC_CSS = `
.adc2 .bdoc{background:#fff;color:#14161a;color-scheme:light;padding:44px 20px 72px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
.adc2 .bdoc *,.adc2 .bdoc *::before,.adc2 .bdoc *::after{box-sizing:border-box}
.adc2 .bdoc .bdoc-wrap{max-width:760px;margin:0 auto}
.adc2 .bdoc-kb .bdoc-wrap{max-width:860px}
.adc2 .bdoc-head{border-bottom:2px solid #14161a;padding-bottom:18px;margin-bottom:32px}
.adc2 .bdoc-kb .bdoc-head{margin-bottom:36px}
.adc2 .bdoc .bdoc-kicker{margin:0 0 6px;color:#5b6470;font-size:.78rem;font-weight:400;letter-spacing:.12em;text-transform:uppercase}
.adc2 .bdoc h1{margin:0 0 8px;color:#14161a;font-size:1.7rem;font-weight:700;letter-spacing:-.02em;line-height:1.25}
.adc2 .bdoc-kb h1{font-size:1.8rem;letter-spacing:-.02em}
.adc2 .bdoc-head p{margin:0;color:#5b6470;font-size:.92rem}
.adc2 .bdoc-kb .bdoc-head p{font-size:.94rem}
.adc2 .bdoc .bdoc-cover{display:flex;justify-content:center;margin:0 0 30px}
.adc2 .bdoc .bdoc-cover img{display:block;width:min(340px,100%);height:auto;border:1px solid #e3e7ec;border-radius:10px;box-shadow:0 18px 44px rgba(20,22,26,.14)}
.adc2 .bdoc .bdoc-lead{margin:0 0 16px;color:#14161a;font-size:1.1rem;font-weight:500;line-height:1.7}
.adc2 .bdoc-kb .bdoc-lead{font-size:1.06rem;margin-bottom:16px;line-height:1.65}
.adc2 .bdoc p{margin:0 0 16px;color:#14161a}
.adc2 .bdoc-kb p{margin:0 0 13px;line-height:1.65}
.adc2 .bdoc h2{margin:30px 0 10px;color:#14161a;font-size:1.1rem;font-weight:700;letter-spacing:-.01em;line-height:1.3}
.adc2 .bdoc-kb h2{margin:48px 0 18px;padding:9px 13px;background:#14161a;color:#fff;border-radius:4px;font-size:1.28rem;letter-spacing:-.01em;line-height:1.3}
.adc2 .bdoc h3{margin:30px 0 10px;color:#14161a;font-size:1.08rem;font-weight:600;letter-spacing:-.01em;line-height:1.35}
.adc2 .bdoc h4{margin:22px 0 8px;color:#14161a;font-size:.96rem;font-weight:600;line-height:1.4}
.adc2 .bdoc a{color:#1f6feb;text-decoration:none;word-break:break-word}
.adc2 .bdoc a:hover{text-decoration:underline}
.adc2 .bdoc b,.adc2 .bdoc strong{color:#14161a;font-weight:600}
.adc2 .bdoc ul,.adc2 .bdoc ol{margin:0 0 15px;padding-left:22px;color:#14161a}
.adc2 .bdoc-kb ul,.adc2 .bdoc-kb ol{padding-left:22px}
.adc2 .bdoc li{margin-bottom:7px;line-height:1.65}
.adc2 .bdoc li:last-child{margin-bottom:0}
.adc2 .bdoc .bdoc-facts{margin:20px 0;padding:14px 18px;background:#f6f8fa;border-left:4px solid #1f6feb;border-radius:0 4px 4px 0;font-size:.94rem}
.adc2 .bdoc-kb .bdoc-facts{margin:16px 0 22px;padding:16px 18px}
.adc2 .bdoc .bdoc-facts p{margin:0 0 6px;line-height:1.7}
.adc2 .bdoc .bdoc-facts p:last-child{margin:0}
.adc2 .bdoc .bdoc-facts ul{margin:0;padding-left:20px}
.adc2 .bdoc .bdoc-facts li{margin-bottom:7px}
.adc2 .bdoc .bdoc-facts li:last-child{margin-bottom:0}
.adc2 .bdoc .bdoc-table{margin:14px 0 20px;width:100%;overflow-x:auto}
.adc2 .bdoc table{width:100%;min-width:520px;border-collapse:collapse;color:#14161a;font-size:.94rem;line-height:1.6}
.adc2 .bdoc th,.adc2 .bdoc td{text-align:left;padding:9px 12px;border:1px solid #e3e7ec;vertical-align:top}
.adc2 .bdoc th{background:#f6f8fa;font-weight:600}
.adc2 .bdoc blockquote{margin:16px 0;padding:12px 16px;border-left:3px solid #e3e7ec;color:#5b6470;font-style:italic}
.adc2 .bdoc blockquote p:last-child{margin:0}
.adc2 .bdoc .bdoc-contact{margin-top:28px;padding-top:18px;border-top:1px solid #e3e7ec;font-size:.94rem}
.adc2 .bdoc .bdoc-contact p{margin:0 0 6px}
.adc2 .bdoc .bdoc-contact p:last-child{margin:0}
.adc2 .bdoc .bdoc-footer{margin-top:52px;padding-top:16px;border-top:1px solid #e3e7ec;color:#5b6470;font-size:.84rem}
.adc2 .bdoc .bdoc-footer p{margin:0;color:#5b6470}
@media (max-width:640px){
.adc2 .bdoc{padding:32px 16px 56px;font-size:15.5px}
.adc2 .bdoc h1{font-size:1.42rem}
.adc2 .bdoc-kb h1{font-size:1.5rem}
.adc2 .bdoc .bdoc-lead{font-size:1.02rem}
.adc2 .bdoc-kb h2{font-size:1.12rem;margin-top:38px;padding:8px 11px}
.adc2 .bdoc .bdoc-cover img{width:min(300px,100%)}
.adc2 .bdoc table{font-size:.88rem}
}
@media print{
.adc2 .bdoc{background:#fff;padding:0}
.adc2 .bdoc a{color:#14161a}
.adc2 .bdoc-kb h2{background:#fff;color:#14161a;border-bottom:2px solid #14161a;border-radius:0;padding-left:0}
}
`;
