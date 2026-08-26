import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}

export default function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover-lift">
      <div 
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity"
        style={{ backgroundColor: accent }} 
      />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-[#a3a3a3] mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ backgroundColor: `${accent}1A`, borderColor: `${accent}33` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}
