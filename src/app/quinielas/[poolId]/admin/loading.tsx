import { Bone, PageSkeleton } from "@/app/skeleton";

export default function AdminLoading() {
  return (
    <PageSkeleton>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-8">
          <Bone className="h-5 w-36 rounded-md" />
          <Bone className="mt-2 h-4 w-full rounded-md" />
          <Bone className="mt-3 h-40" />
        </div>
      ))}
    </PageSkeleton>
  );
}
