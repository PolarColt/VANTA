import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp,
  Filter,
  FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

interface AppointmentStats {
  total: number;
  pending: number;
  approved: number;
  declined: number;
  cancelled: number;
  completed: number;
}

interface MonthlyData {
  month: string;
  appointments: number;
  students: number;
}

interface StudentActivity {
  student_name: string;
  department?: string;
  total_appointments: number;
  last_appointment: string;
}

const Reports: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<AppointmentStats>({
    total: 0,
    pending: 0,
    approved: 0,
    declined: 0,
    cancelled: 0,
    completed: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [studentActivity, setStudentActivity] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (profile) {
      fetchReportData();
    }
  }, [profile, dateRange]);

  const fetchReportData = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      await Promise.all([
        fetchAppointmentStats(),
        fetchMonthlyData(),
        fetchStudentActivity(),
      ]);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointmentStats = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('status')
      .eq('staff_id', profile!.user_id)
      .gte('appointment_date', dateRange.start)
      .lte('appointment_date', dateRange.end);

    if (error) throw error;

    const stats: AppointmentStats = {
      total: data?.length || 0,
      pending: data?.filter(a => a.status === 'pending').length || 0,
      approved: data?.filter(a => a.status === 'approved').length || 0,
      declined: data?.filter(a => a.status === 'declined').length || 0,
      cancelled: data?.filter(a => a.status === 'cancelled').length || 0,
      completed: data?.filter(a => a.status === 'completed').length || 0,
    };

    setStats(stats);
  };

  const fetchMonthlyData = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        appointment_date,
        student_id,
        student_profile:user_profiles!appointments_student_id_fkey(full_name)
      `)
      .eq('staff_id', profile!.user_id)
      .gte('appointment_date', dateRange.start)
      .lte('appointment_date', dateRange.end)
      .order('appointment_date');

    if (error) throw error;

    // Group by month
    const monthlyMap = new Map<string, { appointments: Set<string>; students: Set<string> }>();
    
    data?.forEach(appointment => {
      const month = format(parseISO(appointment.appointment_date), 'MMM yyyy');
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { appointments: new Set(), students: new Set() });
      }
      monthlyMap.get(month)!.appointments.add(appointment.appointment_date);
      monthlyMap.get(month)!.students.add(appointment.student_id);
    });

    const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      appointments: data.appointments.size,
      students: data.students.size,
    }));

    setMonthlyData(monthlyData);
  };

  const fetchStudentActivity = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        student_id,
        appointment_date,
        student_profile:user_profiles!appointments_student_id_fkey(full_name, department)
      `)
      .eq('staff_id', profile!.user_id)
      .gte('appointment_date', dateRange.start)
      .lte('appointment_date', dateRange.end)
      .order('appointment_date', { ascending: false });

    if (error) throw error;

    // Group by student
    const studentMap = new Map<string, {
      name: string;
      department?: string;
      appointments: string[];
    }>();

    data?.forEach(appointment => {
      const studentId = appointment.student_id;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          name: appointment.student_profile?.full_name || 'Unknown',
          department: appointment.student_profile?.department,
          appointments: [],
        });
      }
      studentMap.get(studentId)!.appointments.push(appointment.appointment_date);
    });

    const studentActivity: StudentActivity[] = Array.from(studentMap.entries())
      .map(([studentId, data]) => ({
        student_name: data.name,
        department: data.department,
        total_appointments: data.appointments.length,
        last_appointment: data.appointments[0], // Already sorted by date desc
      }))
      .sort((a, b) => b.total_appointments - a.total_appointments);

    setStudentActivity(studentActivity);
  };

  const exportToCSV = () => {
    const csvData = [
      ['Student Name', 'Department', 'Total Appointments', 'Last Appointment'],
      ...studentActivity.map(student => [
        student.student_name,
        student.department || 'N/A',
        student.total_appointments.toString(),
        format(parseISO(student.last_appointment), 'MMM dd, yyyy'),
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success('Report exported successfully!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Reports & Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            View appointment statistics and student activity
          </p>
        </div>
        
        <button
          onClick={exportToCSV}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-blue-100 text-blue-800', icon: Calendar },
          { label: 'Pending', value: stats.pending, color: 'bg-yellow-100 text-yellow-800', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-800', icon: TrendingUp },
          { label: 'Completed', value: stats.completed, color: 'bg-blue-100 text-blue-800', icon: Users },
          { label: 'Declined', value: stats.declined, color: 'bg-red-100 text-red-800', icon: FileText },
          { label: 'Cancelled', value: stats.cancelled, color: 'bg-gray-100 text-gray-800', icon: FileText },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-md ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trends */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Monthly Trends
        </h2>
        
        {monthlyData.length > 0 ? (
          <div className="space-y-4">
            {monthlyData.map((month) => (
              <div key={month.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="font-medium text-gray-900">{month.month}</span>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {month.appointments} appointments
                  </span>
                  <span className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {month.students} students
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
            <p className="mt-1 text-sm text-gray-500">
              No appointments found for the selected date range.
            </p>
          </div>
        )}
      </div>

      {/* Student Activity */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Student Activity
          </h2>
        </div>
        
        {studentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Appointments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Appointment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentActivity.map((student, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {student.student_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {student.department || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {student.total_appointments}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(parseISO(student.last_appointment), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No student activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              No student appointments found for the selected date range.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;