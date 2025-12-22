export function EmptyState() {
  return (
    <div className="text-center py-8 text-xs text-muted-foreground">
      <p>Ask me anything about this conversation.</p>
      <p className="mt-2">I can help you:</p>
      <ul className="mt-2 space-y-1">
        <li>Draft a reply</li>
        <li>Summarize the conversation</li>
        <li>Suggest talking points</li>
        <li>Brainstorm ideas</li>
      </ul>
    </div>
  );
}
