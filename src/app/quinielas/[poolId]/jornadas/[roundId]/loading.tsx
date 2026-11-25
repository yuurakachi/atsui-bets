import { Bone, PageSkeleton } from "@/app/skeleton";

export default function RoundLoading() {
  return (
    <PageSkeleton>
      <Bone className="mt-2 h-4 w-64 rounded-md" />
      <Bone className="mt-6 h-3 w-full rounded-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <Bone key={i} className="mt-3 h-28" />
      ))}
    </PageSkeleton>
  );
}
