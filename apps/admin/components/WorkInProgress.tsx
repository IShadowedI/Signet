import { Shell } from "@/components/Shell";

export function WorkInProgress({ title }: { title: string }) {
  return (
    <Shell>
      <div className="skeuo-panel mx-auto mt-20 max-w-2xl rounded-[32px] p-12 text-center">
        <div className="skeuo-orange mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl text-4xl">◌</div>
        <h1 className="text-3xl font-bold text-[color:var(--ink)]">{title}</h1>
        <p className="mt-3 text-[color:var(--muted)]">This area is still being worked on.</p>
      </div>
    </Shell>
  );
}
