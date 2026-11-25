import { Bone, PageSkeleton, TableSkeleton } from "@/app/skeleton";

export default function PoolLoading() {
  return (
    <PageSkeleton>
      <Bone className="mt-6 h-20" />
      <Bone className="mt-6 h-36 rounded-2xl" />
      <Bone className="mt-3 h-16" />
      <Bone className="mt-8 h-5 w-32 rounded-md" />
      <TableSkeleton />
    </PageSkeleton>
  );
}
