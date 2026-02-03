import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle, TrendingUp, Settings, Plus, BarChart3 } from 'lucide-react';

const MachineScheduler = () => {
  const [machines, setMachines] = useState([
    { id: 1, name: 'AMADA 345', maxCapacity: 33484.8, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
    { id: 2, name: 'AMADA 367', maxCapacity: 18278.4, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
    { id: 3, name: 'LFK', maxCapacity: 10444.8, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
    { id: 4, name: 'Spot Welding Machine 25KVA (A-Gun) #1 - WPI', maxCapacity: 111744, workHours: 24, workDays: 8, type: 'Spot Welding', currentLoad: 0 },
    { id: 5, name: 'ARC WELD #1', maxCapacity: 17126.4, workHours: 24, workDays: 8, type: 'Arc Weld', currentLoad: 0 },
    { id: 6, name: '50 KVA SPOT WELD', maxCapacity: 10636.8, workHours: 24, workDays: 8, type: 'Spot Welding', currentLoad: 0 }
  ]);

  const [schedules, setSchedules] = useState([]);
  const [activeTab, setActiveTab] = useState('schedule');
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [jobForm, setJobForm] = useState({
    machineId: '',
    jobName: '',
    units: '',
    priority: 'normal',
    month: new Date().toISOString().slice(0, 7)
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const machinesData = await window.storage.get('machines');
      const schedulesData = await window.storage.get('schedules');
      
      if (machinesData) {
        const loadedMachines = JSON.parse(machinesData.value);
        setMachines(loadedMachines);
      }
      
      if (schedulesData) {
        setSchedules(JSON.parse(schedulesData.value));
      }
    } catch (error) {
      console.log('No saved data found, using defaults');
    }
  };

  const saveData = async (newMachines, newSchedules) => {
    try {
      await window.storage.set('machines', JSON.stringify(newMachines));
      await window.storage.set('schedules', JSON.stringify(newSchedules));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const calculateMachineLoad = (machineId, month) => {
    return schedules
      .filter(s => s.machineId === machineId && s.month === month && s.status === 'scheduled')
      .reduce((sum, s) => sum + s.totalCapacity, 0);
  };

  const getMachineUtilization = (machine, month) => {
    const load = calculateMachineLoad(machine.id, month);
    return (load / machine.maxCapacity) * 100;
  };

  const getUtilizationColor = (percentage) => {
    if (percentage < 70) return 'bg-green-500';
    if (percentage < 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const findAlternativeMachine = (machineType, requiredCapacity, month, excludeId) => {
    const sameMachines = machines.filter(m => 
      m.type === machineType && 
      m.id !== excludeId
    );

    for (const machine of sameMachines) {
      const currentLoad = calculateMachineLoad(machine.id, month);
      const available = machine.maxCapacity - currentLoad;
      if (available >= requiredCapacity) {
        return { machine, available };
      }
    }
    return null;
  };

  const handleScheduleJob = () => {
    const machine = machines.find(m => m.id === parseInt(jobForm.machineId));
    if (!machine) {
      alert('Please select a machine');
      return;
    }

    const totalCapacity = parseFloat(jobForm.units);
    
    if (!totalCapacity || !jobForm.jobName) {
      alert('Please enter job name and required capacity');
      return;
    }

    const currentLoad = calculateMachineLoad(machine.id, jobForm.month);
    const available = machine.maxCapacity - currentLoad;

    if (totalCapacity <= available) {
      const newSchedule = {
        id: Date.now(),
        machineId: machine.id,
        machineName: machine.name,
        jobName: jobForm.jobName,
        units: parseFloat(jobForm.units),
        totalCapacity,
        month: jobForm.month,
        priority: jobForm.priority,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      const newSchedules = [...schedules, newSchedule];
      setSchedules(newSchedules);
      saveData(machines, newSchedules);
      
      setShowRecommendation(true);
      setRecommendation({
        type: 'success',
        message: `✅ Job "${jobForm.jobName}" scheduled successfully on ${machine.name}`,
        details: `Capacity used: ${totalCapacity.toFixed(2)} / ${machine.maxCapacity.toFixed(2)} (${((totalCapacity/machine.maxCapacity)*100).toFixed(1)}%)`,
        schedule: newSchedule
      });

      resetForm();
    } else {
      const alternative = findAlternativeMachine(machine.type, totalCapacity, jobForm.month, machine.id);
      
      const nextMonth = new Date(jobForm.month);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().slice(0, 7);

      setShowRecommendation(true);
      setRecommendation({
        type: 'overload',
        message: `❌ Machine ${machine.name} exceeds capacity`,
        details: `Required: ${totalCapacity.toFixed(2)} | Available: ${available.toFixed(2)} | Excess: ${(totalCapacity - available).toFixed(2)}`,
        alternative,
        nextMonth: nextMonthStr,
        originalJob: { ...jobForm, totalCapacity, machine }
      });
    }
  };

  const applyRecommendation = (option) => {
    const rec = recommendation;
    
    if (option === 'alternative' && rec.alternative) {
      const newSchedule = {
        id: Date.now(),
        machineId: rec.alternative.machine.id,
        machineName: rec.alternative.machine.name,
        jobName: rec.originalJob.jobName,
        units: parseFloat(rec.originalJob.units),
        totalCapacity: rec.originalJob.totalCapacity,
        month: rec.originalJob.month,
        priority: rec.originalJob.priority,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      const newSchedules = [...schedules, newSchedule];
      setSchedules(newSchedules);
      saveData(machines, newSchedules);
    } else if (option === 'reschedule') {
      const newSchedule = {
        id: Date.now(),
        machineId: rec.originalJob.machine.id,
        machineName: rec.originalJob.machine.name,
        jobName: rec.originalJob.jobName,
        units: parseFloat(rec.originalJob.units),
        totalCapacity: rec.originalJob.totalCapacity,
        month: rec.nextMonth,
        priority: rec.originalJob.priority,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      const newSchedules = [...schedules, newSchedule];
      setSchedules(newSchedules);
      saveData(machines, newSchedules);
    }

    setShowRecommendation(false);
    setRecommendation(null);
    resetForm();
  };

  const resetForm = () => {
    setJobForm({
      machineId: '',
      jobName: '',
      units: '',
      priority: 'normal',
      month: new Date().toISOString().slice(0, 7)
    });
  };

  const machineTypes = [...new Set(machines.map(m => m.type))];

  const deleteSchedule = async (scheduleId) => {
    const newSchedules = schedules.filter(s => s.id !== scheduleId);
    setSchedules(newSchedules);
    await saveData(machines, newSchedules);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🏭 Intelligent Machine Scheduling System
          </h1>
          <p className="text-slate-300">AI-Powered Load Optimization & Capacity Management</p>
        </div>

        <div className="flex gap-2 mb-6 bg-slate-800/50 p-2 rounded-lg backdrop-blur">
          {[
            { id: 'schedule', label: 'Schedule Job', icon: Plus },
            { id: 'dashboard', label: 'Utilization Dashboard', icon: BarChart3 },
            { id: 'calendar', label: 'Calendar View', icon: Calendar },
            { id: 'forecast', label: 'Forecast', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Plus className="text-blue-400" />
                Schedule New Job
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Job Name</label>
                  <input
                    type="text"
                    value={jobForm.jobName}
                    onChange={(e) => setJobForm({...jobForm, jobName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter job name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Select Machine</label>
                  <select
                    value={jobForm.machineId}
                    onChange={(e) => setJobForm({...jobForm, machineId: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Choose a machine...</option>
                    {machineTypes.map(type => (
                      <optgroup key={type} label={type}>
                        {machines.filter(m => m.type === type).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} - {getMachineUtilization(m, jobForm.month).toFixed(1)}% utilized
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-300">Required Capacity (Units)</label>
                  <input
                    type="number"
                    value={jobForm.units}
                    onChange={(e) => setJobForm({...jobForm, units: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., 32000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">Priority</label>
                    <select
                      value={jobForm.priority}
                      onChange={(e) => setJobForm({...jobForm, priority: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-300">Target Month</label>
                    <input
                      type="month"
                      value={jobForm.month}
                      onChange={(e) => setJobForm({...jobForm, month: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {jobForm.units && jobForm.machineId && (
                  <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-300">
                      Total Required Capacity: {parseFloat(jobForm.units).toFixed(2)}
                    </p>
                    {(() => {
                      const selectedMachine = machines.find(m => m.id === parseInt(jobForm.machineId));
                      const currentLoad = calculateMachineLoad(selectedMachine.id, jobForm.month);
                      const available = selectedMachine.maxCapacity - currentLoad;
                      const required = parseFloat(jobForm.units);
                      
                      return (
                        <p className="text-xs text-slate-400 mt-1">
                          Available on {selectedMachine.name}: {available.toFixed(2)} 
                          {required > available && (
                            <span className="text-red-400 font-semibold"> ⚠️ Exceeds capacity!</span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                )}

                <button
                  onClick={handleScheduleJob}
                  disabled={!jobForm.machineId || !jobForm.units || !jobForm.jobName}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all shadow-lg"
                >
                  Schedule Job
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6">Machine Information</h2>
              
              {jobForm.machineId ? (
                <div className="space-y-4">
                  {(() => {
                    const selectedMachine = machines.find(m => m.id === parseInt(jobForm.machineId));
                    const utilization = getMachineUtilization(selectedMachine, jobForm.month);
                    const currentLoad = calculateMachineLoad(selectedMachine.id, jobForm.month);
                    const available = selectedMachine.maxCapacity - currentLoad;

                    return (
                      <>
                        <div>
                          <h3 className="text-xl font-semibold text-blue-400">{selectedMachine.name}</h3>
                          <p className="text-slate-400">Type: {selectedMachine.type}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Max Capacity:</span>
                            <span className="font-medium">{selectedMachine.maxCapacity.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Current Load:</span>
                            <span className="font-medium">{currentLoad.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Available:</span>
                            <span className="font-medium text-green-400">{available.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Work Hours/Days:</span>
                            <span className="font-medium">{selectedMachine.workHours}h × {selectedMachine.workDays}d</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-slate-400">Utilization</span>
                            <span className="text-sm font-bold">{utilization.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                            <div
                              className={`h-full ${getUtilizationColor(utilization)} transition-all duration-500`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-700/50 rounded-lg p-4">
                          <h4 className="font-semibold mb-2 text-cyan-400">Same Type Machines</h4>
                          {machines.filter(m => m.type === selectedMachine.type && m.id !== selectedMachine.id).map(m => {
                            const util = getMachineUtilization(m, jobForm.month);
                            return (
                              <div key={m.id} className="flex justify-between items-center py-1 text-sm">
                                <span className="text-slate-300">{m.name}</span>
                                <span className={`font-medium ${util < 90 ? 'text-green-400' : 'text-red-400'}`}>
                                  {util.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-500">
                  Select a machine to view details
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Machine Utilization Dashboard</h2>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {machines.map(machine => {
                const utilization = getMachineUtilization(machine, currentMonth);
                const currentLoad = calculateMachineLoad(machine.id, currentMonth);
                const available = machine.maxCapacity - currentLoad;

                return (
                  <div key={machine.id} className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg mb-1">{machine.name}</h3>
                        <p className="text-sm text-slate-400">{machine.type}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        utilization < 70 ? 'bg-green-500/20 text-green-400' :
                        utilization < 90 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {utilization.toFixed(1)}%
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getUtilizationColor(utilization)} transition-all duration-500`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Max Capacity</p>
                          <p className="font-bold">{machine.maxCapacity.toFixed(0)}</p>
                        </div>
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Current Load</p>
                          <p className="font-bold">{currentLoad.toFixed(0)}</p>
                        </div>
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Available</p>
                          <p className="font-bold text-green-400">{available.toFixed(0)}</p>
                        </div>
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400 text-xs">Scheduled Jobs</p>
                          <p className="font-bold">{schedules.filter(s => s.machineId === machine.id && s.month === currentMonth).length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Scheduled Jobs Calendar</h2>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 bg-slate-700 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              {schedules
                .filter(s => s.month === currentMonth)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(schedule => (
                  <div key={schedule.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-blue-500 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{schedule.jobName}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            schedule.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                            schedule.priority === 'normal' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {schedule.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-slate-300 mb-2">{schedule.machineName}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-400">Required Capacity:</span>
                            <span className="ml-2 font-medium">{schedule.units}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Total Load:</span>
                            <span className="ml-2 font-medium text-cyan-400">{schedule.totalCapacity.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Scheduled:</span>
                            <span className="ml-2 font-medium">{new Date(schedule.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Month:</span>
                            <span className="ml-2 font-medium">{schedule.month}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="ml-4 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              
              {schedules.filter(s => s.month === currentMonth).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No jobs scheduled for this month
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'forecast' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6">Capacity Forecast (Next 3 Months)</h2>
            
            <div className="space-y-6">
              {(() => {
                const months = [];
                const today = new Date();
                for (let i = 0; i < 3; i++) {
                  const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                  months.push(date.toISOString().slice(0, 7));
                }

                return months.map(month => (
                  <div key={month} className="border border-slate-600 rounded-lg p-4">
                    <h3 className="text-xl font-bold mb-4 text-blue-400">
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {machines.map(machine => {
                        const utilization = getMachineUtilization(machine, month);
                        const currentLoad = calculateMachineLoad(machine.id, month);
                        
                        return (
                          <div key={machine.id} className="bg-slate-700/50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-sm">{machine.name}</span>
                              <span className={`text-xs font-bold ${
                                utilization < 70 ? 'text-green-400' :
                                utilization < 90 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {utilization.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-600 rounded-full h-2">
                              <div
                                className={`h-full rounded-full ${getUtilizationColor(utilization)}`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              Load: {currentLoad.toFixed(0)} / {machine.maxCapacity.toFixed(0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {showRecommendation && recommendation && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full border border-slate-700 shadow-2xl">
              {recommendation.type === 'success' ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="text-green-400" size={32} />
                    <h3 className="text-2xl font-bold text-green-400">Schedule Confirmed</h3>
                  </div>
                  <p className="text-lg mb-2">{recommendation.message}</p>
                  <p className="text-slate-300 mb-6">{recommendation.details}</p>
                  <button
                    onClick={() => setShowRecommendation(false)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-red-400" size={32} />
                    <h3 className="text-2xl font-bold text-red-400">Capacity Exceeded</h3>
                  </div>
                  <p className="text-lg mb-2">{recommendation.message}</p>
                  <p className="text-slate-300 mb-6">{recommendation.details}</p>

                  <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
                    <h4 className="font-bold mb-3 text-cyan-400">AI Recommendations:</h4>
                    
                    {recommendation.alternative && (
                      <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500 rounded-lg">
                        <p className="font-semibold mb-2">✅ Option 1: Transfer to Alternative Machine</p>
                        <p className="text-sm text-slate-300 mb-2">
                          Transfer to <span className="font-bold text-blue-400">{recommendation.alternative.machine.name}</span> (same type: {recommendation.alternative.machine.type})
                        </p>
                        <p className="text-sm text-slate-400">
                          Available capacity: {recommendation.alternative.available.toFixed(2)}
                        </p>
                        <button
                          onClick={() => applyRecommendation('alternative')}
                          className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition-all"
                        >
                          Schedule on {recommendation.alternative.machine.name}
                        </button>
                      </div>
                    )}

                    <div className="p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                      <p className="font-semibold mb-2">🔁 Option {recommendation.alternative ? '2' : '1'}: Reschedule to Next Month</p>
                      <p className="text-sm text-slate-300 mb-2">
                        Move job to <span className="font-bold text-yellow-400">{new Date(recommendation.nextMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                      </p>
                      <button
                        onClick={() => applyRecommendation('reschedule')}
                        className="mt-3 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg transition-all"
                      >
                        Reschedule to {recommendation.nextMonth}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowRecommendation(false)}
                    className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineScheduler;
