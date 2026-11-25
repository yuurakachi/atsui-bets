import { Bone, PageSkeleton, TableSkeleton } from "@/app/skeleton";

export default function StatsLoading() {
  return (
    <PageSkeleton>
      <Bone className="mt-6 h-56 rounded-2xl" />
      <Bone className="mt-8 h-5 w-36 rounded-md" />
      <TableSkeleton rows={3} />
      <Bone className="mt-8 h-5 w-32 rounded-md" />
      <Bone className="mt-3 h-28" />
      <Bone className="mt-2 h-28" />
    </PageSkeleton>
  );
}
