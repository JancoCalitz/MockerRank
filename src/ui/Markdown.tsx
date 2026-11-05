import ReactMarkdown from 'react-markdown';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate prose-sm max-w-none prose-pre:bg-slate-800 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
