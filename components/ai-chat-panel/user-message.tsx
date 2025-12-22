interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="max-w-[90%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground">
      <p className="text-xs whitespace-pre-wrap">{content}</p>
    </div>
  );
}
