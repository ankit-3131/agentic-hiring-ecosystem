import React from 'react';

const AdminPortal: React.FC = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500">
      
      {/* Header section */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-2 h-8 bg-destructive rounded-sm"></div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Admin dashboard</h1>
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">Role: Platform Admin</span>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <p className="text-muted-foreground text-sm font-medium mb-1">Total Users</p>
          <p className="text-white text-3xl font-semibold mb-2">1,248</p>
          <p className="text-xs text-primary">+12% from last month</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-muted-foreground text-sm font-medium mb-1">Active Agents</p>
          <p className="text-white text-3xl font-semibold mb-2">432</p>
          <p className="text-xs text-primary">+5% from last month</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-muted-foreground text-sm font-medium mb-1">System Health</p>
          <p className="text-primary text-3xl font-semibold mb-2">99.9%</p>
          <p className="text-xs text-muted-foreground">All systems operational</p>
        </div>
      </div>

      <div className="glass-card p-6">
         <h2 className="text-xl font-bold text-white mb-4">Platform Overview</h2>
         <p className="text-sm text-muted-foreground mb-6">Manage global configurations, view system logs, and monitor OpenAI / Gemini API limits.</p>
         
         <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-background/50 text-white font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">API Calls (Today)</th>
                  <th className="px-4 py-3">Cost Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="bg-card hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white">Gemini 2.5 Flash</td>
                  <td className="px-4 py-3"><span className="text-primary">Operational</span></td>
                  <td className="px-4 py-3 text-muted-foreground">1.2k / 10k</td>
                  <td className="px-4 py-3 text-muted-foreground">$0.45</td>
                </tr>
                <tr className="bg-card hover:bg-white/5 transition">
                  <td className="px-4 py-3 text-white">LangGraph Backend</td>
                  <td className="px-4 py-3"><span className="text-primary">Operational</span></td>
                  <td className="px-4 py-3 text-muted-foreground">-</td>
                  <td className="px-4 py-3 text-muted-foreground">-</td>
                </tr>
              </tbody>
            </table>
         </div>
      </div>

    </div>
  );
};

export default AdminPortal;
