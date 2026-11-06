import { CodeBlock } from "@/components/learning/code-block";
import { InlineContent } from "@/components/learning/inline-content";
import { toBlocks } from "@/lib/community/content";

/** A post as React elements: text is escaped, links are web or site paths only. */
export function PostBody({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed break-words">
      {toBlocks(body).map((block, index) =>
        block.type === "code" ? (
          <CodeBlock key={index} code={block.code} language={block.language} />
        ) : (
          <p key={index}>
            <InlineContent nodes={block.content} />
          </p>
        )
      )}
    </div>
  );
}
