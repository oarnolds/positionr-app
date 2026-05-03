export function ChipList({
  title,
  items,
  variant = "default",
}: {
  title: string;
  items: string[];
  variant?: "default" | "warning";
}) {
  const chipBase =
    variant === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-gray-50 border-gray-200 text-gray-800";
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`rounded-full border px-3 py-1 text-xs ${chipBase}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
