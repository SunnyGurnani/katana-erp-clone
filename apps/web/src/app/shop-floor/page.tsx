"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Play, Square, Check, Clock, User, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function ShopFloorApp() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [operatorId, setOperatorId] = useState<string>("");

  // Simplified view meant for a tablet on the shop floor
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["shop-floor-tasks"],
    queryFn: () => api.get("/tasks").then((r) => r.data.data || []),
    // Frequent polling for shop floor
    refetchInterval: 10000, 
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then(r => r.data.data || [])
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-floor-tasks"] });
      addToast("Task updated", "success");
    },
    onError: () => addToast("Failed to update task", "error")
  });

  const handleStart = (id: string) => updateTask.mutate({ id, status: "in_progress" });
  const handleComplete = (id: string) => updateTask.mutate({ id, status: "completed" });
  const handlePause = (id: string) => updateTask.mutate({ id, status: "paused" });

  if (!operatorId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 page-transition font-sans">
        <div className="card max-w-md w-full p-8 text-center shadow-xl border-gray-200">
          <div className="mx-auto w-16 h-16 bg-navy-800 rounded-2xl flex items-center justify-center mb-6 shadow-md">
            <WrenchIcon className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Shop Floor App</h1>
          <p className="text-gray-500 mb-8">Select your operator profile to continue</p>
          
          <div className="space-y-3">
            {(users || []).map((u: any) => (
              <button 
                key={u.id}
                onClick={() => setOperatorId(u.id)}
                className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-brand-100 mr-4">
                  <User size={20} className="text-gray-500 group-hover:text-brand-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{u.name || u.email}</div>
                  <div className="text-xs text-gray-500">Operator</div>
                </div>
              </button>
            ))}
            {users?.length === 0 && (
              <div className="text-gray-400 py-4">No operators found. Please add users in Settings.</div>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link href="/dashboard/sell" className="text-sm text-brand-600 hover:text-brand-800 flex items-center justify-center gap-1">
              <LayoutDashboard size={14} /> Back to ERP Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeOperator = users?.find((u: any) => u.id === operatorId);

  // Filter tasks: only show open/in_progress, sorted by date
  const myTasks = (tasks || [])
    .filter((t: any) => ["todo", "in_progress", "paused"].includes(t.status))
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="flex flex-col h-screen bg-gray-100 page-transition font-sans">
      {/* Top Header */}
      <header className="bg-navy-900 text-white p-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg">
            <WrenchIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Shop Floor</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full hidden sm:flex">
            <User size={16} className="text-gray-300" />
            <span className="font-medium text-sm">{activeOperator?.name || activeOperator?.email}</span>
          </div>
          <button 
            onClick={() => setOperatorId("")}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 text-red-100 hover:bg-red-500/40 rounded-lg transition-colors"
          >
            <LogOut size={16} /> Exit
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 px-2">Your Tasks</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-32 bg-white rounded-xl shadow-sm animate-pulse" />
              <div className="h-32 bg-white rounded-xl shadow-sm animate-pulse" />
            </div>
          ) : myTasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">There are no open tasks assigned right now.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {myTasks.map((t: any) => {
                const isWIP = t.status === "in_progress";
                const isPaused = t.status === "paused";
                
                return (
                  <div 
                    key={t.id} 
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                      isWIP ? "border-brand-500 ring-1 ring-brand-500 shadow-md" : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-stretch">
                      {/* Status Indicator Bar */}
                      <div className={`h-2 sm:h-auto sm:w-2 shrink-0 ${
                        isWIP ? "bg-brand-500" : isPaused ? "bg-amber-400" : "bg-gray-300"
                      }`} />
                      
                      <div className="flex-1 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              MO-{t.manufacturingOrderId?.slice(0, 8).toUpperCase() || "MO"}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              isWIP ? "bg-brand-100 text-brand-700" : 
                              isPaused ? "bg-amber-100 text-amber-700" : 
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {isWIP ? "IN PROGRESS" : isPaused ? "PAUSED" : "NOT STARTED"}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{t.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {t.plannedQty && (
                              <span className="flex items-center gap-1">
                                <Boxes size={14} /> {t.plannedQty} pcs
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={14} /> {t.estimatedDuration || "—"} mins
                            </span>
                          </div>
                        </div>

                        {/* Tablet-friendly Large Actions */}
                        <div className="flex items-center gap-3 shrink-0 mt-2 sm:mt-0">
                          {isWIP ? (
                            <>
                              <button 
                                onClick={() => handlePause(t.id)}
                                disabled={updateTask.isPending}
                                className="flex flex-col items-center justify-center flex-1 sm:w-20 h-16 sm:h-20 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-colors border border-amber-200"
                              >
                                <Square size={20} className="sm:mb-1" />
                                <span className="text-xs font-bold hidden sm:block">Pause</span>
                              </button>
                              <button 
                                onClick={() => handleComplete(t.id)}
                                disabled={updateTask.isPending}
                                className="flex flex-col items-center justify-center flex-1 sm:w-20 h-16 sm:h-20 bg-green-500 text-white rounded-xl hover:bg-green-600 active:bg-green-700 transition-colors shadow-sm"
                              >
                                <Check size={24} className="sm:mb-1" />
                                <span className="text-xs font-bold hidden sm:block">Done</span>
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleStart(t.id)}
                              disabled={updateTask.isPending}
                              className="flex items-center justify-center gap-2 h-16 sm:h-20 flex-1 sm:w-auto sm:px-8 bg-brand-600 text-white rounded-xl hover:bg-brand-700 active:bg-brand-800 transition-colors shadow-sm text-lg font-bold"
                            >
                              <Play size={20} fill="currentColor" />
                              {isPaused ? "Resume" : "Start"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function WrenchIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  );
}

function Boxes(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );
}
