import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ProfileEmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="m-0 mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action === undefined ? null : <div className="mt-4">{action}</div>}
    </div>
  );
}
