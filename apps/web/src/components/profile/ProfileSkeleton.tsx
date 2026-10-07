import { Skeleton } from "@hasut/ui";

export function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
        <Skeleton className="size-[88px] shrink-0 rounded-full sm:size-[104px]" />
        <div className="flex w-full flex-1 flex-col items-center gap-3 sm:items-start">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-36" />
          <div className="flex w-full gap-2 sm:w-auto">
            <Skeleton className="h-10 flex-1 sm:w-32 sm:flex-none" />
            <Skeleton className="h-10 flex-1 sm:w-24 sm:flex-none" />
          </div>
          <div className="mt-2 flex w-full justify-around gap-6 sm:justify-start">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-1 sm:gap-2 lg:grid-cols-4">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="aspect-square rounded-md sm:rounded-lg" />
        ))}
      </div>
    </div>
  );
}
