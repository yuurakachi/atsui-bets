import { Bone, PageSkeleton, TableSkeleton } from "@/app/skeleton";

export default function SettlementLoading() {
  return (
    <PageSkeleton>
      <Bone className="mt-2 h-4 w-64 rounded-md" />
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Bone className="h-16" />
        <Bone className="h-16" />
        <Bone className="h-16" />
      </div>
      <Bone className="mt-8 h-5 w-32 rounded-md" />
      <TableSkeleton />
    </PageSkeleton>
  );
}
