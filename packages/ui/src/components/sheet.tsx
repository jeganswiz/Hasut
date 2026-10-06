"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

export function Sheet(props: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

export function SheetTrigger(props: ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

export function SheetClose(props: ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close {...props} />;
}

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      <Dialog.Content
        data-slot="sheet"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-border bg-card p-4 text-card-foreground shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="size-4" />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetTitle(props: ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className="text-lg font-semibold" {...props} />;
}
