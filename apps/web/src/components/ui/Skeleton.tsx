export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="page-transition">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 30}%`, animationDelay: `${i * 50}ms` }} />
        </td>
      ))}
    </tr>
  );
}
export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={cols} />)}</>;
}
