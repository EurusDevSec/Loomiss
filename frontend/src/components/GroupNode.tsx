interface GroupNodeProps {
  data: {
    label: string;
    borderClr?: string;
    bgClr?: string;
  };
}

export default function GroupNode({ data }: GroupNodeProps) {
  const borderClr = data.borderClr || '#27272a';
  const bgClr = data.bgClr || 'rgba(24, 24, 27, 0.2)';

  return (
    <div
      className="rounded-2xl border border-dashed h-full w-full relative transition-all duration-300 pointer-events-none"
      style={{
        borderColor: borderClr,
        backgroundColor: bgClr,
        boxShadow: `inset 0 0 20px ${borderClr}12`,
      }}
    >
      {/* Title tab in top-left */}
      <div
        className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono text-zinc-100 uppercase tracking-wider border pointer-events-auto select-none"
        style={{
          backgroundColor: '#09090b',
          borderColor: borderClr,
          boxShadow: `0 0 10px ${borderClr}33`,
        }}
      >
        {data.label}
      </div>
    </div>
  );
}
